import * as net from 'net';
import maxmind, { CityResponse, AsnResponse, IspResponse } from 'maxmind';
import nodesApi from '../../../api/explorer/nodes.api';
import config from '../../../config';
import DB from '../../../database';
import logger from '../../../logger';
import { ResultSetHeader } from 'mysql2';
import * as IPCheck from '../../../utils/ipcheck.js';
import { Reader } from 'mmdb-lib';

export async function $lookupNodeLocation(): Promise<void> {
  let loggerTimer = new Date().getTime() / 1000;
  let progress = 0;
  let nodesUpdated = 0;
  let geoNamesInserted = 0;

  logger.debug(`Running node location updater using Maxmind`, logger.tags.ln);
  try {
    const nodes = await nodesApi.$getAllNodes();
    const lookupCity = await maxmind.open<CityResponse>(config.MAXMIND.GEOLITE2_CITY);
    const lookupAsn = await maxmind.open<AsnResponse>(config.MAXMIND.GEOLITE2_ASN);
    let lookupIsp: Reader<IspResponse> | null = null;
    try {
      lookupIsp = await maxmind.open<IspResponse>(config.MAXMIND.GEOIP2_ISP);
    } catch (e) { }

    for (const node of nodes) {
      const sockets: string[] = node.sockets.split(',');
      for (const socket of sockets) {
        const ip = socket.substring(0, socket.lastIndexOf(':')).replace('[', '').replace(']', '');
        const hasClearnet = [4, 6].includes(net.isIP(ip));

        if (hasClearnet && ip !== '127.0.1.1' && ip !== '127.0.0.1') {
          const city = lookupCity.get(ip);
          const asn = lookupAsn.get(ip);
          let isp: IspResponse | null = null;
          if (lookupIsp) {
            isp = lookupIsp.get(ip);
          }

          let asOverwrite: any | undefined;
          if (asn && (IPCheck.match(ip, '170.75.160.0/20') || IPCheck.match(ip, '172.81.176.0/21'))) {
            asOverwrite = {
              asn: 394745,
              name: 'Lunanode',
            };
          }
          else if (asn && (IPCheck.match(ip, '50.7.0.0/16') || IPCheck.match(ip, '66.90.64.0/18'))) {
            asOverwrite = {
              asn: 30058,
              name: 'FDCservers.net',
            };
          }
          else if (asn && asn.autonomous_system_number === 174) {
            asOverwrite = {
              asn: 174,
              name: 'Cogent Communications',
            };
          }

          if (city && (asn || isp)) {
            const query = `
              UPDATE nodes SET 
                as_number = ?, 
                city_id = ?, 
                country_id = ?, 
                subdivision_id = ?, 
                longitude = ?, 
                latitude = ?, 
                accuracy_radius = ?
              WHERE public_key = ?
            `;

            const params = [
              asOverwrite?.asn ?? isp?.autonomous_system_number ?? asn?.autonomous_system_number,
              city.city?.geoname_id,
              city.country?.geoname_id,
              city.subdivisions ? city.subdivisions[0].geoname_id : null,
              city.location?.longitude,
              city.location?.latitude,
              city.location?.accuracy_radius,
              node.public_key
            ];
            let result = await DB.query<ResultSetHeader>(query, params);
            if (result[0].changedRows ?? 0 > 0) {
              ++nodesUpdated;
            }

            // Store Continent
            if (city.continent?.geoname_id) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'continent', ?)`,
                [city.continent?.geoname_id, JSON.stringify(city.continent?.names)]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }

            // Store Country
            if (city.country?.geoname_id) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'country', ?)`,
                [city.country?.geoname_id, JSON.stringify(city.country?.names)]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }

            // Store Country ISO code
            if (city.country?.iso_code) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'country_iso_code', ?)`,
                [city.country?.geoname_id, city.country?.iso_code]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }

            // Store Division
            if (city.subdivisions && city.subdivisions[0]) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'division', ?)`,
                [city.subdivisions[0].geoname_id, JSON.stringify(city.subdivisions[0]?.names)]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }

            // Store City
            if (city.city?.geoname_id) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'city', ?)`,
                [city.city?.geoname_id, JSON.stringify(city.city?.names)]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }

            // Store AS name
            if (isp?.autonomous_system_organization ?? asn?.autonomous_system_organization) {
              result = await DB.query<ResultSetHeader>(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'as_organization', ?)`,
                [
                  asOverwrite?.asn ?? isp?.autonomous_system_number ?? asn?.autonomous_system_number,
                  JSON.stringify(asOverwrite?.name ?? isp?.isp ?? asn?.autonomous_system_organization)
                ]);
              if (result[0].changedRows ?? 0 > 0) {
                ++geoNamesInserted;
              }
            }
          }

          ++progress;
          const elapsedSeconds = Math.round((new Date().getTime() / 1000) - loggerTimer);
          if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
            logger.debug(`Updating node location data ${progress}/${nodes.length}`);
            loggerTimer = new Date().getTime() / 1000;
          }
        }
      }
    }

    if (nodesUpdated > 0) {
      logger.debug(`${nodesUpdated} nodes maxmind data updated, ${geoNamesInserted} geo names inserted`, logger.tags.ln);
    }
  } catch (e) {
    logger.err('$lookupNodeLocation() error: ' + (e instanceof Error ? e.message : e));
  }
}

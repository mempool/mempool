import * as net from 'net';
import maxmind, { CityResponse, AsnResponse, IspResponse } from 'maxmind';
import nodesApi from '../../../api/explorer/nodes.api';
import config from '../../../config';
import DB from '../../../database';
import logger from '../../../logger';
import * as IPCheck from '../../../utils/ipcheck.js';

export async function $lookupNodeLocation(): Promise<void> {
  let loggerTimer = new Date().getTime() / 1000;
  let progress = 0;

  logger.info(`Running node location updater using Maxmind`);
  try {
    const nodes = await nodesApi.$getAllNodes();
    const lookupCity = await maxmind.open<CityResponse>(config.MAXMIND.GEOLITE2_CITY);
    const lookupAsn = await maxmind.open<AsnResponse>(config.MAXMIND.GEOLITE2_ASN);
    const lookupIsp = await maxmind.open<IspResponse>(config.MAXMIND.GEOIP2_ISP);

    for (const node of nodes) {
      const sockets: string[] = node.sockets.split(',');
      for (const socket of sockets) {
        const ip = socket.substring(0, socket.lastIndexOf(':')).replace('[', '').replace(']', '');
        const hasClearnet = [4, 6].includes(net.isIP(ip));

        if (hasClearnet && ip !== '127.0.1.1' && ip !== '127.0.0.1') {
          const city = lookupCity.get(ip);
          const asn = lookupAsn.get(ip);
          const isp = lookupIsp.get(ip);

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
            await DB.query(query, params);

            // Store Continent
            if (city.continent?.geoname_id) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'continent', ?)`,
                [city.continent?.geoname_id, JSON.stringify(city.continent?.names)]);
            }

            // Store Country
            if (city.country?.geoname_id) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'country', ?)`,
                [city.country?.geoname_id, JSON.stringify(city.country?.names)]);
            }

            // Store Country ISO code
            if (city.country?.iso_code) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'country_iso_code', ?)`,
                [city.country?.geoname_id, city.country?.iso_code]);
            }

            // Store Division
            if (city.subdivisions && city.subdivisions[0]) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'division', ?)`,
                [city.subdivisions[0].geoname_id, JSON.stringify(city.subdivisions[0]?.names)]);
            }

            // Store City
            if (city.city?.geoname_id) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'city', ?)`,
                [city.city?.geoname_id, JSON.stringify(city.city?.names)]);
            }

            // Store AS name
            if (isp?.autonomous_system_organization ?? asn?.autonomous_system_organization) {
              await DB.query(
                `INSERT IGNORE INTO geo_names (id, type, names) VALUES (?, 'as_organization', ?)`,
                [
                  asOverwrite?.asn ?? isp?.autonomous_system_number ?? asn?.autonomous_system_number,
                  JSON.stringify(asOverwrite?.name ?? isp?.isp ?? asn?.autonomous_system_organization)
                ]);
            }
          }

          ++progress;
          const elapsedSeconds = Math.round((new Date().getTime() / 1000) - loggerTimer);
          if (elapsedSeconds > 10) {
            logger.info(`Updating node location data ${progress}/${nodes.length}`);
            loggerTimer = new Date().getTime() / 1000;
          }
        }
      }
    }
    logger.info(`${progress} nodes location data updated`);
  } catch (e) {
    logger.err('$lookupNodeLocation() error: ' + (e instanceof Error ? e.message : e));
  }
}

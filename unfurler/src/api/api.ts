import fetch from 'node-fetch';
import http from 'node:http';
import https from 'node:https';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const agentSelector = function(_parsedURL: any) {
    if (_parsedURL.protocol == 'http:') {
        return httpAgent;
    } else {
        return httpsAgent;
    }
}

export async function fetchJSON(url, defaultVal = null) {
  try {
    const response = await fetch(url, { agent: agentSelector });
    return response.ok ? response.json() : defaultVal;
  } catch (error) {
    return defaultVal;
  }
}

export async function fetchText(url, defaultVal = null) {
  try {
    const response = await fetch(url, { agent: agentSelector });
    return response.ok ? response.text() : defaultVal;
  } catch (error) {
    return defaultVal;
  }
}
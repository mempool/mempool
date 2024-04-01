import { v4 as uuid } from 'uuid';
import { WebSocket, Server } from 'mock-socket';

declare global {
	interface Window {
		mockServer: Server;
		mockSocket: WebSocket;
	}
}

const mocks: { [key: string]: { server: Server; websocket: WebSocket } } = {};

const cleanupMock = (url: string) => {
	if (mocks[url]) {
		mocks[url].websocket.close();
		mocks[url].server.stop();
		delete mocks[url];
	}
};

const createMock = (url: string) => {
	cleanupMock(url);
	const server = new Server(url);
	const websocket = new WebSocket(url);
	mocks[url] = { server, websocket };

	return mocks[url];
};

export const mockWebSocket = () => {
	cy.on('window:before:load', (win) => {
		const winWebSocket = win.WebSocket;
		cy.stub(win, 'WebSocket').callsFake((url) => {
			console.log(url);
			if ((new URL(url).pathname.indexOf('/sockjs-node/') !== 0)) {
				const { server, websocket } = createMock(url);

				win.mockServer = server;
				win.mockServer.on('connection', (socket) => {
					win.mockSocket = socket;
					win.mockSocket.send('{"conversions":{"USD":32365.338815782445}}');
					cy.readFile('cypress/fixtures/mainnet_live2hchart.json', 'ascii').then((fixture) => {
						win.mockSocket.send(JSON.stringify(fixture));
					});
					cy.readFile('cypress/fixtures/mainnet_mempoolInfo.json', 'ascii').then((fixture) => {
						win.mockSocket.send(JSON.stringify(fixture));
					});
				});

				win.mockServer.on('message', (message) => {
					console.log(message);
				});

				return websocket;
			} else {
				return new winWebSocket(url);
			}
		});
	});

	cy.on('window:before:unload', () => {
		for (const url in mocks) {
			cleanupMock(url);
		}
	});
};

export const emitMempoolInfo = ({
	params
}: { params?: any } = {}) => {
	cy.window().then((win) => {
		//TODO: Refactor to take into account different parameterized mocking scenarios
		switch (params.network) {
			//TODO: Use network specific mocks
			case "signet":
			case "testnet":
			case "mainnet":
			default:
				break;
		}

		switch (params.command) {
			case "init": {
				win.mockSocket.send('{"conversions":{"USD":32365.338815782445}}');
				cy.readFile('cypress/fixtures/mainnet_live2hchart.json', 'ascii').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				});
				cy.readFile('cypress/fixtures/mainnet_mempoolInfo.json', 'ascii').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				});
				break;
			}
			case "rbfTransaction": {
				cy.readFile('cypress/fixtures/mainnet_rbf.json', 'ascii').then((fixture) => {
					win.mockSocket.send(JSON.stringify(fixture));
				});
				break;
			}
			default:
				break;
		}
	});
    cy.waitForSkeletonGone();
    return cy.get('#mempool-block-0');
};

export const dropWebSocket = (() => {
    cy.window().then((win) => {
        win.mockServer.simulate("error");
    });
    return cy.wait(500);
});

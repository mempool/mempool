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
        win.mockSocket.send('{"action":"init"}');
        win.mockSocket.send('{"action":"want","data":["blocks","stats","mempool-blocks","live-2h-chart"]}');
        win.mockSocket.send('{"mempoolInfo":{"loaded":true,"size":162,"bytes":97414,"usage":331776,"maxmempool":300000000,"mempoolminfee":0.00001,"minrelaytxfee":0.00001,"unbroadcastcount":0},"vBytesPerSecond":1681,"lastDifficultyAdjustment":1626564737,"blocks":[{"id":"0000000000000000000a7a7f911a7c4eeee6f15493cc428b3b86bb72213b60c3","height":692326,"version":541065220,"timestamp":1627062511,"tx_count":2004,"size":1225378,"weight":3199474,"merkle_root":"adea158b7e92b776f71c8a294433af0a3d698616f96bff830bbfd51d9b98bd74","previousblockhash":"0000000000000000000842423759a4c0ba15c2919e6cbd0afbda870013488eab","mediantime":1627060668,"nonce":1415789086,"bits":387225124,"difficulty":13672594272814,"reward":634174866,"coinbaseTx":{"vin":[{"scriptsig":"0366900a1b4d696e656420627920416e74506f6f6c3735330700ab02004de920fabe6d6d96ded1b1558afd9d7327ca5992a6b3c89ac1e9475219df08ff691ee891709fff0200000000000000271b0100e5560200"}],"vout":[{"scriptpubkey_address":"12dRugNcdxK39288NjcDV4GX7rMsKCGn6B","value":634174866}]},"medianFee":4.021238938053098,"feeRange":[1,2.3335297583971717,3.0111358574610243,3.1343283582089554,4.6559714795008915,9.052143684820393,20.07773851590106,251.46886016451234],"matchRate":100},{"id":"00000000000000000010d532068d69e9b3d66f28d00d37efbfe165064c344f78","height":692327,"version":547356676,"timestamp":1627063081,"tx_count":1899,"size":1163455,"weight":3084304,"merkle_root":"035560beea83798a540e03274d286a519eef5f0c25f10ec6d20a0bc03122719c","previousblockhash":"0000000000000000000a7a7f911a7c4eeee6f15493cc428b3b86bb72213b60c3","mediantime":1627061403,"nonce":339169815,"bits":387225124,"difficulty":13672594272814,"reward":632348731,"coinbaseTx":{"vin":[{"scriptsig":"0367900a3a205468697320626c6f636b20776173206d696e65642077697468206120636172626f6e206e6567617469766520706f77657220736f75726365201209687a2009092009022ff11c401192040000"}],"vout":[{"scriptpubkey_address":"33SAB6pzbhEGPbfY6NVgRDV7jVfspZ3A3Z","value":632348731}]},"medianFee":3.612541144432538,"feeRange":[1,2.3274021352313166,2.7517401392111367,3.045936395759717,4.134513274336284,7.010452961672474,18.102697998259355,247.18840579710144],"matchRate":100},{"id":"0000000000000000000c657e4a318f108e6b69cff8f2df2eca80157ec185b72d","height":692328,"version":536870916,"timestamp":1627063223,"tx_count":575,"size":324173,"weight":824666,"merkle_root":"3988c6dcf7f220ee35fe1c009eb6d9b456fc3d80693105228f795c2c97160cce","previousblockhash":"00000000000000000010d532068d69e9b3d66f28d00d37efbfe165064c344f78","mediantime":1627061592,"nonce":3476769191,"bits":387225124,"difficulty":13672594272814,"reward":627606635,"coinbaseTx":{"vin":[{"scriptsig":"0368900a04b903fb602f706f6f6c696e2e636f6d2ffabe6d6dc217c4ecd75c43d1ecfc2efbcf566c4f29669f23821f066c42f54997a38c4d5e0100000000000000bb32aee74e15225b7ce91312eb97937411ddbd5cd800c3d0010000000000"}],"vout":[{"scriptpubkey_address":"1PQwtwajfHWyAkedss5utwBvULqbGocRpu","value":627606635}]},"medianFee":4.014134275618375,"feeRange":[1,2.3321554770318023,2.8890959925442683,3.0513274336283187,5.026737967914438,8.035555555555556,21.0920245398773,327.25868725868725],"matchRate":100},{"id":"00000000000000000003546583467ac8205f2e1dc5a26623ece8686997ec32b6","height":692329,"version":549453828,"timestamp":1627063814,"tx_count":1933,"size":1589133,"weight":3992757,"merkle_root":"8f35d68a034638b1ea1d4306c9d12bc7e1d74cd6545dd8ceb44e5fa25189f14a","previousblockhash":"0000000000000000000c657e4a318f108e6b69cff8f2df2eca80157ec185b72d","mediantime":1627061821,"nonce":1050893118,"bits":387225124,"difficulty":13672594272814,"reward":634295757,"coinbaseTx":{"vin":[{"scriptsig":"0369900a040606fb602f466f756e6472792055534120506f6f6c202364726f70676f6c642f03eeffa1e267000000000000"}],"vout":[{"scriptpubkey_address":"19dENFt4wVwos6xtgwStA6n8bbA57WCS58","value":634295757}]},"medianFee":3.1620674865636356,"feeRange":[1.0602691632533645,2.341463414634146,2.744597249508841,3.015929203539823,4.5049088359046285,8.361256544502618,16.309077269317328,326],"matchRate":99},{"id":"0000000000000000000a4233ea88ca736483e8204f92d1d6d3ebe317d61831d9","height":692330,"version":545259524,"timestamp":1627063859,"tx_count":415,"size":995745,"weight":3639201,"merkle_root":"d0e8b79787b0a7559626a65184dae8075e7c8355a99413973c5e0bd08773a2e5","previousblockhash":"00000000000000000003546583467ac8205f2e1dc5a26623ece8686997ec32b6","mediantime":1627061964,"nonce":4136069327,"bits":387225124,"difficulty":13672594272814,"reward":627675075,"coinbaseTx":{"vin":[{"scriptsig":"036a900a1b4d696e656420627920416e74506f6f6c373038430051020856a641fabe6d6d14f508bf77d560f030d68ca0349782b581782eb135ba9c351e8851ec7c79c5060200000000000000514b0500561e8f04"}],"vout":[{"scriptpubkey_address":"12dRugNcdxK39288NjcDV4GX7rMsKCGn6B","value":627675075}]},"medianFee":1.930410079299544,"feeRange":[1,1.0124777183600713,1.406855439642325,1.9289493575207861,1.9312406576980568,2.101364522417154,5.026737967914438,300],"matchRate":100},{"id":"00000000000000000002ce275508e863b2334016bd8b5b502ab2484eaffdeb95","height":692331,"version":939515908,"timestamp":1627064116,"tx_count":904,"size":459487,"weight":1254616,"merkle_root":"7f4045450dc0c1ddaf3e7081cfb98609574025a3af8d000c59243409bf6ba2ac","previousblockhash":"0000000000000000000a4233ea88ca736483e8204f92d1d6d3ebe317d61831d9","mediantime":1627062511,"nonce":212437990,"bits":387225124,"difficulty":13672594272814,"reward":628855993,"coinbaseTx":{"vin":[{"scriptsig":"036b900a2cfabe6d6d909e56369d88a5549f2c675d4b94be38c37d256710d99ae7477fbf0c5ad8238910000000f09f909f082f4632506f6f6c2f0000000000000000000000000000000000000000000000000000000000000000000000000500c25f3b60"}],"vout":[{"scriptpubkey_address":"1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY","value":628855993}]},"medianFee":3.049924357034796,"feeRange":[1,2.018832391713748,2.5955967555040558,3.013333333333333,3.1963470319634704,6.982332155477032,15.073170731707316,349.65034965034965],"matchRate":100},{"id":"000000000000000000001c72e186481a52e4a96fbaf826b4e0b1a911406d9920","height":692332,"version":536870916,"timestamp":1627064361,"tx_count":919,"size":487515,"weight":1373427,"merkle_root":"f95bf7c2741b473a1bec042ebb2f460910e238150f9ad38d96dc54b3c78cc829","previousblockhash":"00000000000000000002ce275508e863b2334016bd8b5b502ab2484eaffdeb95","mediantime":1627063081,"nonce":1124825968,"bits":387225124,"difficulty":13672594272814,"reward":628134519,"coinbaseTx":{"vin":[{"scriptsig":"036c900a1a2f5669614254432f4d696e6564206279206b7a6d696e6573742f2cfabe6d6dbe2dd1b3b257a46fb4e3d1d423c0ab245f20c0fcf40453bac72baf3f50a78869100000000000000010a7cd810c944608cc814cc233c3ef0100"}],"vout":[{"scriptpubkey_address":"18cBEMRxXHqzWWCxZNtU91F5sbUNKhL5PX","value":628134519}]},"medianFee":3.015985992144243,"feeRange":[1,2.0094250706880303,2.341463414634146,2.926829268292683,3.166077738515901,5.914691943127962,15.073170731707316,252.26244343891403],"matchRate":100},{"id":"000000000000000000032ac544beccce7d86e95d96a6b20aa51bea005176413d","height":692333,"version":536870916,"timestamp":1627064715,"tx_count":1231,"size":846733,"weight":2406331,"merkle_root":"975c1f46b95c75e4e1d33cefdd79cbe1c38facccecdc2a0f4be089e68861a3d6","previousblockhash":"000000000000000000001c72e186481a52e4a96fbaf826b4e0b1a911406d9920","mediantime":1627063223,"nonce":3894610789,"bits":387225124,"difficulty":13672594272814,"reward":632450584,"coinbaseTx":{"vin":[{"scriptsig":"036d900a2cfabe6d6d547c11843fc7c2611a286d8d27808bdf0d704b207a35bd7ac67ea35eaf4e586910000000f09f909f082f4632506f6f6c2f0000000000000000000000000000000000000000000000000000000000000000000000000500e2800000"}],"vout":[{"scriptpubkey_address":"1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY","value":632450584}]},"medianFee":3.0205015644701816,"feeRange":[1,1.993920972644377,2.4211920529801323,3.0018761726078798,3.167259786476868,5.470499243570348,15.054811205846528,1502.8790786948177],"matchRate":100}],"conversions":{"USD":32346.87822235156},"mempool-blocks":[{"blockSize":119059,"blockVSize":96947,"nTx":159,"totalFees":1705585,"medianFee":3.0588235294117645,"feeRange":[1,2.01423487544484,2.345549738219895,3.0136157337367626,3.8798586572438163,21.10144927536232,21.1021897810219,288.6238532110092]}],"transactions":[{"txid":"0abf7d5d8b979eaa28498d8f3f1718366a456d839e1736d18cd52e1506034da6","fee":135735,"vsize":3336.25,"value":6136429},{"txid":"84e828e7591ac1fb70cf400273eac7afed37fef96fd3b6ec1ea8bb5033fc6262","fee":659,"vsize":141.25,"value":5693956},{"txid":"620ae585cdf0ab0e43ba75564d8c35591fa05b904c1f2c4e368c6be0469be3fc","fee":9497,"vsize":144.25,"value":167624},{"txid":"a25f1c0257d4bdea31c9caed4e313faf59c9f0b60c14629a5c67e5c142a02371","fee":7365,"vsize":2878.25,"value":370178286},{"txid":"f0f8faff931f0c783f36886ea5671cd1f99ca19c7d28dbbade6ecc4348ae9348","fee":570,"vsize":221,"value":33672},{"txid":"c1c1a6be8e6d3986df26eca3c89c27cccbc2dd227d9e8eaaf3e38719d77ffdd0","fee":472,"vsize":191.5,"value":69133819}],"backendInfo":{"hostname":"node201.mempool.space","gitCommit":"5197a15e3151aaba89c7044955e705a09f79672e","version":"2.2.1-dev"},"loadingIndicators":{}}');
        win.mockSocket.send('{"conversions":{"USD":32365.338815782445}}');
        win.mockSocket.send('{"live-2h-chart":{"id":1319298,"added":"2021-07-23T18:27:34.000Z","unconfirmed_transactions":546,"tx_per_second":3.93333,"vbytes_per_second":1926,"mempool_byte_weight":1106656,"total_fee":6198583,"vsizes":[255,18128,43701,58534,17144,5532,4483,1759,2394,1089,1683,7409,751,101010,1151,592,1497,703,1369,4747,800,1221,0,0,712,0,0,0,0,0,0,0,0,0,0,0,0,0]}}');
	});
    cy.waitForSkeletonGone();
    return cy.get('#mempool-block-0');
};

const WebSocket = require('ws');

function testWs() {
    const url = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
    console.log(`Connecting to ${url}...`);
    
    const ws = new WebSocket(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    ws.on('open', () => {
        console.log('WebSocket connection opened successfully!');
        ws.close();
    });

    ws.on('error', (e) => {
        console.error('WebSocket connection error:', e);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed.');
    });

    setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
            console.log('Timed out waiting for open event.');
            ws.terminate();
        }
    }, 10000);
}

testWs();

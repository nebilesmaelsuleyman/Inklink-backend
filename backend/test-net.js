const https = require('https');

function testFetch() {
    console.log('Testing connection to speech.platform.bing.com...');
    const options = {
        hostname: 'speech.platform.bing.com',
        port: 443,
        path: '/consumer/speech/synthesize/readaloud/voices/list',
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    };

    const req = https.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        res.on('data', (d) => {
            // console.log(d.toString());
        });
    });

    req.on('error', (e) => {
        console.error('Fetch error:', e);
    });

    req.end();
}

testFetch();

import { SerialPort, ReadlineParser } from 'serialport';
import Timeout from 'await-timeout';
import chalk from 'chalk';

// Set this to your desired sequence of IPs to configure.
const IPS = [
    "10.7.100.1",
];

const getPorts = async () => (await SerialPort.list()).filter(port => {
    const vid = port.vendorId;
    const pid = port.productId;
    if (vid === undefined || pid === undefined) {
        return false;
    }
    const serial_filters = [
        ['303a', '1001'],
        ['1a86', '7523'],
        ['303a', '814e'],
        ['303a', '814f'],
    ];
    for (const [v, p] of serial_filters) {
        if (v === vid && p === pid) {
            return true;
        }
    }
    return false;
});

let ports = await getPorts();

if (ports.length > 1) {
    console.log('Only one device supported at a time')
    process.exit();
}

// Process one device lifecycle, from plug to flash to unplug
const processDevice = async (ip_segments) => {
    const ip_str = ip_segments.join('.');
    const hostname_str = ip_segments.join('-');

    if (ports.length !== 1) {
        console.log(chalk.blue('READY') + ' to program ' + chalk.yellowBright(ip_str) + ' - plug in a new device (or Ctrl+C to exit)');
        while (ports.length !== 1) {
            // Recheck ports 10 times per second
            await Timeout.set(100);
            ports = await getPorts();
        }
    }
    console.log('Detected a new serial device...');

    const serialport = new SerialPort({ path: ports[0].path, baudRate: 115200 });
    const parser = serialport.pipe(new ReadlineParser());

    const makeResponsePromise = (parser, randomId) => new Promise(resolve => {
        parser.on('data', d => {
            try {
                const data = JSON.parse(d);
                if (data['_rid'] !== randomId) {
                    console.error('mismatched query response: ' + d);
                }
                resolve(data);
                parser.removeAllListeners('data');
            } catch {
                if (d.trim() !== '') {
                    console.error('[unparseable response] ' + d);
                }
            }
        });
    });

    const actions = [
        "info",
        "setLeds",
        "setNetwork"
    ];

    for (const action of actions) {
        const doAction = async (query) => {
            const responsePromise = makeResponsePromise(parser, action);
            serialport.write(query);
            const response = await responsePromise;
            if (response.result !== true) {
                console.log('ERROR: Something went wrong with this device: ' + JSON.stringify(response));
                process.exit();
            }
        };

        if (action === "info") {
            const query = '{"cmd":"get","key":"info","_rid":"info"}';
            await doAction(query);
            console.log("- Device responded with info.");
        } else if (action === "setLeds") {
            const query = '{"cmd":"set","key":"leds","data":{"chipset":"SK9822","speed":1000000,"length":250,"color_order":"RGB","gamma":[[1,1,0],[1,1,0],[1,1,0]]},"_rid":"setLeds"}';
            await doAction(query);
            console.log("- LEDs configured.");
        } else if (action === "setNetwork") {
            const query = '{"cmd":"set","key":"network","data":{"hostname":"' + hostname_str + '","ethernet":{"ip":"' + ip_str + '","subnet":"255.255.255.0","gateway":"10.0.0.1"},"wifi":{"ssid":"","password":"","ip":"","subnet":"","gateway":""}},"_rid":"setNetwork"}';
            await doAction(query);
            console.log("- Network configured.");
        }
    }

    console.log(chalk.green('DONE') + ' - unplug the device now');
    while (ports.length === 1) {
        // Recheck ports 10 times per second
        await Timeout.set(100);
        ports = await getPorts();
    }
};

for (const ip of IPS) {
    const ip_segments = Array.from(ip.trim().split('.').map(s => Number(s)));
    // sorry ipv6
    if (ip_segments.length !== 4 || !ip_segments.every((n) => (n <= 255 && n > 0))) {
        console.error('could not parse IP address ' + ip);
    }
    await processDevice(ip_segments);
}

console.log(chalk.green('All devices configured.'));

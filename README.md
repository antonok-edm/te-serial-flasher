# te-serial-flasher

_flash devices, in serial, over serial_

Basically https://config.chroma.tech/config but designed for rapidly iterating through many devices at a time for specific configurations.
In particular, each device will be given a unique IP address from a provided sequence.

## Providing an IP address sequence

Modify the `IPS` array in `index.mjs` to contain your desired sequence.
They will be iterated through in order when starting the script.

## Running

```bash
> npm install
> node .
```

The script will interactively guide you through the process of plugging and unplugging devices in the desired order.

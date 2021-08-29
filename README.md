# dhcpd-multihome
A library to configure a multihome dhcpd server

This basically does what the dhcpd library does, except it allows you to configure for more than one interface. I didn't fork the other one or create a PR simply because I don't want to have to learn typescript.

## Usage
```
// Create an ISC dhcp server for two interfaces
const DHCP = require('dhcp-multihome');

const dhcp = new DHCP({
  defaultLeaseTime: 1200,           // Defaults to 600
  networks: [
    {
      iface: 'eth1',
      subnet: '192.168.4.0',
      domainName: 'example.com',
      nameservers: ['1.1.1.1', '1.1.1.2']
    },
    {
      iface: 'wlan0',
      subnet: '192.168.5.0',
      netmask: '255.255.255.0',     // Defaults to 255.255.255.0
      routers: '192.168.5.1',       // Defaults to first IP in subnet
      beginIP: '192.168.5.2',       // Defaults to second IP in subnet
      endIP: '192.168.5.254',       // Defaults to last IP in subnet
      domainName: 'example1.com',
      nameservers: ['1.1.1.1', '1.1.1.2']
    }
  ]
});
```

## Additional options
|Option|Type|Description|Default|
|------|----|-----------|-------|
|defaultLeaseTime|Integer|Default lease time in seconds|600|
|maxLeaseTime|Integer|Maximum lease time in seconds|7200|
|ddnsUpdateStyle|String|ddns-update-style option; see isc-dhcp-server man page |none|
|authoritative|Boolean|This is the authoritative DHCP server on the network|true|

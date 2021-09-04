'use strict';
const joi = require('joi');
const fs = (process.env.TESTENV) ? require('memfs') : require('fs');
const {Netmask} = require('netmask');
const systemctl = require('systemctl');

function updateOptionInFile(fname, option, value) {
    let fileContents = fs.readFileSync(fname, 'utf-8');
    const pattern = `${option}=.+`;
    const re = new RegExp(pattern);
    let m = fileContents.match(re);
    if (fileContents.indexOf(option) >= 0) {
        fileContents = fileContents.replace(re, `${option}=${value}`);
    } else {
        // Append to the end of the file
        fileContents = `${fileContents}\n${option}=${value}\n`;
    }
    fs.writeFileSync(fname, fileContents, 'utf-8');
}

function incrementIP(ip) {
    let parts = ip.split('.');
    parts[3] = `${parseInt(parts[3])+1}`;
    return parts.join('.');
}

function DhcpMulti(config) {
    // Configure here
    const schema = joi.object({
        defaultLeaseTime: joi.number().default(600),
        maxLeaseTime: joi.number().default(7200),
        authoritative: joi.boolean().default(true),
        ddnsUpdateStyle: joi.string().min(1).default('none'),
        networks: joi.array().items(
            joi.object({
                iface: joi.string().min(1).required(),
                subnet: joi.string().min(1).required(),
                netmask: joi.string().ip().default('255.255.255.0'),
                routers: joi.string().ip().optional(),
                beginIP: joi.string().ip().optional(),
                endIP: joi.string().ip().optional(),
                domainName: joi.string().domain().required(),
                nameservers: joi.array().items(joi.string().ip()).min(1).required()
            }).min(1).required()
        )
    });

    let validated = joi.attempt(config, schema);
    validated.networks.forEach(network => {
        const net = new Netmask(`${network.subnet}/${network.netmask}`);
        network.routers = network.routers || net.first;
        network.beginIP = network.beginIP || incrementIP(net.first);
        network.endIP = network.endIP || net.last;
    });

    this.config = validated;

    // Linux config files
    this.defaultsFilePath = '/etc/default/isc-dhcp-server';
    this.configFilePath = '/etc/dhcp/dhcpd.conf';
}

DhcpMulti.prototype.deploy = async function(force = true) {
    // Read current files
    const oldDefaults = fs.readFileSync(this.defaultsFilePath, 'utf-8');
    const oldConfig = fs.readFileSync(this.configFilePath, 'utf-8');

    // Write the config files
    if (fs.existsSync(this.defaultsFilePath)) {
        // In debian we have to update the interfaces here
        const interfaces = this.config.networks.map(net => net.iface).join(' ');
        updateOptionInFile(this.defaultsFilePath, 'INTERFACESv4', `"${interfaces}"`);
    } else {
        throw new Error(`ISC dhcp defaults file not present: ${this.defaultsFilePath}`);
    }
    if (!fs.existsSync(this.configFilePath)) {
        throw new Error(`ISC dhcp config file not present: ${this.configFilePath}`);
    }
    // Generate the config
    let configOutput = [
        `default-lease-time ${this.config.defaultLeaseTime};`,
        `max-lease-time ${this.config.maxLeaseTime};`,
        `ddns-update-style ${this.config.ddnsUpdateStyle};`,
        ...(this.config.authoritative) ? ['authoritative;'] : []
    ];
    for (let i = 0; i < this.config.networks.length; i++) {
        let net = this.config.networks[i];
        let section = [
            `subnet ${net.subnet} netmask ${net.netmask} {`,
            `  interface ${net.iface};`,
            `  range ${net.beginIP} ${net.endIP};`,
            `  option routers ${net.routers};`,
            `  option subnet-mask 255.255.255.0;`,
            `  option domain-name-servers ${net.nameservers.join(', ')};`,
            '}'
        ];
        configOutput = configOutput.concat(section);
    }

    let configStr = configOutput.join('\n');
    fs.writeFileSync(this.configFilePath, configStr, 'utf-8');

    const newDefaults = fs.readFileSync(this.defaultsFilePath, 'utf-8');
    const newConfig = fs.readFileSync(this.configFilePath, 'utf-8');
    if (force || oldDefaults !== newDefaults || oldConfig !== newConfig) {
        await systemctl.restart('isc-dhcp-server');
    }
}

module.exports = DhcpMulti;
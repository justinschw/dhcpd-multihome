'use strict';
process.env.TESTENV = true;
const DHCP = require('../lib/dhcpMulti');
const expect = require('chai').expect;
const fs = require('fs');
const memfs = require('memfs');
const systemctl = require('systemctl');
const sandbox = require('sinon').createSandbox();

describe('/lib/dhcpMulti', function() {
    describe('constructor', function() {
        it('valid', function(done) {
            const dhcp = new DHCP({
                networks: [
                    {
                        iface: 'eth1',
                        subnet: '192.168.5.0',
                        domainName: 'example.com',
                        nameservers: ['1.1.1.1', '1.1.1.2']
                    }
                ]
            });

            expect(dhcp.config.networks[0].beginIP).eql('192.168.5.2');
            expect(dhcp.config.networks[0].endIP).eql('192.168.5.254');
            expect(dhcp.config.networks[0].routers).eql('192.168.5.1');
            done();
        });

        it('valid custom', function(done) {
            const dhcp = new DHCP({
                networks: [
                    {
                        iface: 'eth1',
                        subnet: '192.168.5.0',
                        domainName: 'example.com',
                        routers: '192.168.5.254',
                        beginIP: '192.168.5.1',
                        endIP: '192.168.5.253',
                        nameservers: ['1.1.1.1', '1.1.1.2']
                    }
                ]
            });

            expect(dhcp.config.networks[0].beginIP).eql('192.168.5.1');
            expect(dhcp.config.networks[0].endIP).eql('192.168.5.253');
            expect(dhcp.config.networks[0].routers).eql('192.168.5.254');
            done();
        });
    });

    describe('deploy', function() {
        beforeEach(function() {
            // Create mock config file structure
            const defaultsContents = fs.readFileSync(`${__dirname}/data/defaults`, 'utf-8');
            memfs.mkdirSync('/etc/default/', {recursive: true});
            memfs.mkdirSync('/etc/dhcp/', {recursive: true});
            memfs.writeFileSync('/etc/default/isc-dhcp-server', defaultsContents, 'utf-8');
            memfs.writeFileSync('/etc/dhcp/dhcpd.conf', '', 'utf-8');
            sandbox.stub(systemctl, 'restart').resolves();
        });

        afterEach(function() {
            sandbox.restore();
        });

        it('valid', function(done) {
            const dhcp = new DHCP({
                networks: [
                    {
                        iface: 'eth1',
                        subnet: '192.168.5.0',
                        domainName: 'example.com',
                        nameservers: ['1.1.1.1', '1.1.1.2']
                    }
                ]
            });

            dhcp.deploy().then(() => {
                const defaultFileContents = memfs.readFileSync(dhcp.defaultsFilePath, 'utf-8');
                const configContents = memfs.readFileSync(dhcp.configFilePath, 'utf-8');
                expect(defaultFileContents.indexOf('INTERFACESv4="eth1"')).gte(0);
                expect(configContents.indexOf('interface eth1')).gte(0);
                expect(configContents.indexOf('routers 192.168.5.1')).gte(0);
                expect(configContents.indexOf('range 192.168.5.2 192.168.5.254')).gte(0);
                done();
            });
        });

        it('no defaults file',  function(done) {
            const dhcp = new DHCP({
                networks: [
                    {
                        iface: 'eth1',
                        subnet: '192.168.5.0',
                        domainName: 'example.com',
                        nameservers: ['1.1.1.1', '1.1.1.2']
                    }
                ]
            });

            memfs.unlinkSync(dhcp.defaultsFilePath);
            dhcp.deploy().then(() => {
                done(new Error('should have failed'));
            }).catch(err => {
                done();
            });
        });

        it('no config file',  function(done) {
            const dhcp = new DHCP({
                networks: [
                    {
                        iface: 'eth1',
                        subnet: '192.168.5.0',
                        domainName: 'example.com',
                        nameservers: ['1.1.1.1', '1.1.1.2']
                    }
                ]
            });

            memfs.unlinkSync(dhcp.configFilePath);
            dhcp.deploy().then(() => {
                done(new Error('should have failed'));
            }).catch(err => {
                done();
            });
        });
    })
})
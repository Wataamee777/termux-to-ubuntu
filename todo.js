const axios = require('axios');
const zlib = require('zlib');
const fs = require('fs');

async function getPackages(url) {
    console.log(`Fetching: ${url}`);
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        const content = zlib.gunzipSync(res.data).toString('utf-8');
        const pkgs = new Set();
        content.split('\n').forEach(line => {
            if (line.startsWith('Package: ')) {
                pkgs.add(line.replace('Package: ', '').trim());
            }
        });
        return pkgs;
    } catch (e) {
        console.error(`Error: ${e.message}`);
        return new Set();
    }
}

async function main() {
    const BASE_U = 'http://archive.ubuntu.com/ubuntu/dists/noble';
    const BASE_P = 'http://ports.ubuntu.com/ubuntu-ports/dists/noble';
    const BASE_T = 'https://packages-cf.termux.dev/apt/termux-main/dists/stable/main';

    const [uX86, uArm, tArm] = await Promise.all([
        getPackages(`${BASE_U}/main/binary-amd64/Packages.gz`),
        getPackages(`${BASE_P}/main/binary-arm64/Packages.gz`),
        getPackages(`${BASE_T}/binary-aarch64/Packages.gz`)
    ]);

    // ロジック：(Ubuntu-x86にある OR Ubuntu-Armにある) AND Termuxにはない
    const allUbuntu = new Set([...uX86, ...uArm]);
    const todo = [...allUbuntu].filter(pkg => !tArm.has(pkg)).sort();

    fs.writeFileSync('todo.json', JSON.stringify({ targets: todo }, null, 2));
    console.log(`Total potential treasures: ${todo.length}`);
}
main();

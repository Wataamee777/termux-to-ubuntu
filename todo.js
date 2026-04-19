const axios = require('axios');
const zlib = require('zlib');
const fs = require('fs');

/**
 * リポジトリのリストを取得してパースする
 * @param {string} url 
 * @param {string} type 'ubuntu' | 'termux'
 */
async function getList(url, type) {
    console.log(`Downloading ${type} list from: ${url}`);
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        const content = zlib.gunzipSync(res.data).toString('utf-8');
        
        const x86_64 = new Set();
        const arm64 = new Set();

        const lines = content.split('\n');
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'FILE LOCATION') continue;

            if (type === 'ubuntu') {
                if (trimmed.endsWith('.deb')) {
                    const file = trimmed.split(/\s+/).pop();
                    const pkgName = file.split('_')[0];
                    if (file.includes('_amd64.deb')) x86_64.add(pkgName);
                    if (file.includes('_arm64.deb') || file.includes('_aarch64.deb')) arm64.add(pkgName);
                }
            } else if (type === 'termux') {
                // Contents-aarch64.gz の形式（末尾がパッケージ名）
                const parts = trimmed.split(/\s+/);
                const pkg = parts.pop();
                const pkgName = pkg.includes('/') ? pkg.split('/').pop() : pkg;
                arm64.add(pkgName);
            }
        }
        return { x86_64, arm64 };
    } catch (e) {
        console.error(`Error fetching ${type}: ${e.message}`);
        return { x86_64: new Set(), arm64: new Set() };
    }
}

async function main() {
    // 1. Ubuntu (noble/main) の全ファイルリスト
    const uUrl = 'https://archive.ubuntu.com/ubuntu/ls-lR.gz';
    // 2. Termux 公式の全ファイルリスト
    const tUrl = 'https://packages-cf.termux.dev/apt/termux-main/dists/stable/Contents-aarch64.gz';

    const [ubuntu, termux] = await Promise.all([
        getList(uUrl, 'ubuntu'),
        getList(tUrl, 'termux')
    ]);

    // 【ロジック】
    // Ubuntuのx86_64には存在するが、
    // 「Ubuntuのarm64」にも「Termuxのarm64」にも存在しないもの
    const todo = [...ubuntu.x86_64].filter(pkg => 
        !ubuntu.arm64.has(pkg) && 
        !termux.arm64.has(pkg)
    ).sort();

    // 結果の保存
    const result = {
        total_x86_64: ubuntu.x86_64.size,
        total_arm64_exists: ubuntu.arm64.size + termux.arm64.size,
        target_count: todo.length,
        targets: todo
    };

    fs.writeFileSync('todo.json', JSON.stringify(result, null, 2));
    
    console.log(`\n--- 統計 ---`);
    console.log(`Ubuntu x86_64 総数: ${ubuntu.x86_64.size}`);
    console.log(`不足（お宝候補）: ${todo.length}`);
    console.log(`最初の5個: ${todo.slice(0, 5).join(', ')}`);
}

main();

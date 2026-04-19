const axios = require('axios');
const zlib = require('zlib');
const fs = require('fs');

async function getPackages(url) {
    console.log(`取得中: ${url}`);
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
        console.error(`取得失敗: ${url} (${e.message})`);
        return new Set();
    }
}

async function main() {
    // --- エンドポイント設定 ---
    const BASE_U = 'http://archive.ubuntu.com/ubuntu/dists/noble/main';
    const BASE_P = 'http://ports.ubuntu.com/ubuntu-ports/dists/noble/main';
    const BASE_T = 'https://packages-cf.termux.dev/apt/termux-main/dists/stable/main';

    const [uX86, uArm, tArm] = await Promise.all([
        getPackages(`${BASE_U}/binary-amd64/Packages.gz`),   // Ubuntu x86_64
        getPackages(`${BASE_P}/binary-arm64/Packages.gz`),   // Ubuntu Arm64
        getPackages(`${BASE_T}/binary-aarch64/Packages.gz`)  // Termux Arm64
    ]);

    // 【お宝ロジック】
    // 1. Ubuntu(Arm64)にはあるが、Termuxにはない（成功率：高）
    const easyTargets = [...uArm].filter(pkg => !tArm.has(pkg));

    // 2. Ubuntu(x86_64)にしかない（成功率：低だが、真のお宝）
    const rareTargets = [...uX86].filter(pkg => !uArm.has(pkg) && !tArm.has(pkg));

    // 統合してソート
    const allTodo = [...new Set([...easyTargets, ...rareTargets])].sort();

    const result = {
        stats: {
            ubuntu_x86_only: rareTargets.length,
            ubuntu_arm_but_not_termux: easyTargets.length,
            total_targets: allTodo.length
        },
        targets: allTodo
    };

    fs.writeFileSync('todo.json', JSON.stringify(result, null, 2));
    
    console.log(`\n--- 発掘結果 ---`);
    console.log(`成功率高（Arm版あり）: ${easyTargets.length}件`);
    console.log(`未知の領域（x86版のみ）: ${rareTargets.length}件`);
    console.log(`合計 ${allTodo.length} 件を todo.json に保存しました。`);
}

main();

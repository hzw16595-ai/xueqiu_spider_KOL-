// ============================================================
// 增量导出脚本 - 把已爬数据导出为CSV文件（自动下载）
// ============================================================
// 在当前Chrome Console中直接执行即可，不影响正在运行的爬虫
// 可以随时执行，每次下载一个带时间戳的新文件
// ============================================================

(function() {
    if (typeof allResults === 'undefined' || allResults.length === 0) {
        console.log('❌ 没有找到数据（allResults为空），请先运行爬虫脚本');
        return;
    }

    // CSV内容构建
    function escapeCSV(str) {
        if (str === null || str === undefined) return '';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    // 毫秒时间戳 → YYYY-MM-DD HH:MM:SS
    function formatTime(ts) {
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    // CSV表头（datetime列在前，date列保留用于筛选）
    const headers = [
        'post_id', 'user_id', 'user_name', 'kol_name', 'kol_id',
        'datetime', 'date', 'text', 'retweet', 'retweet_text',
        'all_stocks', 'matched_stocks', 'is_matched',
        'like_count', 'reply_count', 'retweet_count'
    ];

    // 添加BOM头，确保Excel打开时中文不乱码
    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';

    for (const row of allResults) {
        const values = headers.map(h => {
            if (h === 'datetime') return escapeCSV(formatTime(row.created_at));
            return escapeCSV(row[h]);
        });
        csvContent += values.join(',') + '\n';
    }

    // 统计
    const matched = allResults.filter(r => r.is_matched);
    const unmatched = allResults.filter(r => !r.is_matched);
    
    const stockCoverage = {};
    matched.forEach(r => {
        r.matched_stocks.split(';').filter(Boolean).forEach(s => {
            stockCoverage[s] = (stockCoverage[s] || 0) + 1;
        });
    });

    console.log(`\n===== 导出统计 =====`);
    console.log(`总帖子数: ${allResults.length}`);
    console.log(`匹配KOL关联股票: ${matched.length}`);
    console.log(`含标签但不匹配: ${unmatched.length}`);
    console.log(`处理KOL数: ${typeof processedKols !== 'undefined' ? processedKols : '未知'}`);
    console.log(`覆盖股票数: ${Object.keys(stockCoverage).length}`);
    console.log(`\n各股票匹配帖子数:`);
    Object.entries(stockCoverage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([s, c]) => console.log(`  ${s}: ${c} 条`));

    // 自动下载CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const timestamp = now.getFullYear() + 
        String(now.getMonth()+1).padStart(2,'0') + 
        String(now.getDate()).padStart(2,'0') + '_' +
        String(now.getHours()).padStart(2,'0') + 
        String(now.getMinutes()).padStart(2,'0');
    
    const matchedCount = matched.length;
    a.href = url;
    a.download = `xueqiu_posts_${timestamp}_${matchedCount}条匹配.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`\n✅ CSV文件已开始下载！`);
    console.log(`文件名: xueqiu_posts_${timestamp}_${matchedCount}条匹配.csv`);
    console.log(`提示: 下载到浏览器默认下载目录，用Excel直接打开即可`);
    console.log(`\n⚠️ 注意: 不匹配的帖子(is_matched=false)也包含在CSV中`);
    console.log(`   如只需匹配帖子，在Excel中筛选 is_matched 列 = true`);
})();

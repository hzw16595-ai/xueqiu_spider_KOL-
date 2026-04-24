// 在Chrome Console中粘贴执行
// 功能：遍历上证50所有股票的影响力用户API，输出结果到页面和console
(async()=>{
  // 上证50成分股代码
  const stocks = [
    'SH600519','SH600036','SH601318','SH600276','SH600887','SH601166','SH600030','SH601398','SH601939','SH600000',
    'SH600016','SH601288','SH600585','SH601668','SH600104','SH601888','SH600690','SH601012','SH600309','SH600809',
    'SH601857','SH601988','SH600028','SH601088','SH600837','SH600031','SH600346','SH600893','SH601138','SH601628',
    'SH600436','SH600905','SH600908','SH601225','SH601899','SH600196','SH601601','SH600588','SH600745','SH601236',
    'SH600085','SH601111','SH600150','SH601688','SH600570','SH601985','SH600132','SH601127','SH600900','SZ000858',
    'SZ000333','SZ000651'
  ];

  // 去重
  const unique = [...new Set(stocks)];
  let all = [];
  let success = 0;
  let fail = 0;

  console.log(`开始获取 ${unique.length} 只股票的影响力用户...`);

  for (let i = 0; i < unique.length; i++) {
    const s = unique[i];
    try {
      const r = await fetch('https://xueqiu.com/recommend-proxy/recommend_user.json?symbol=' + s + '&category=1001');
      const d = await r.json();
      if (d.code === 200 && d.data && d.data.items) {
        all.push({
          symbol: s,
          count: d.data.items.length,
          users: d.data.items.map(item => ({
            id: item.id,
            screen_name: item.screen_name,
            followers_count: item.followers_count,
            status_count: item.status_count,
            verified: item.verified_infos ? item.verified_infos.map(v => v.verified_desc || '').join('; ') : ''
          }))
        });
        success++;
        console.log(`[${i+1}/${unique.length}] ${s}: ${d.data.items.length} 个KOL ✓`);
      } else {
        all.push({ symbol: s, error: d.message || 'unknown' });
        fail++;
        console.log(`[${i+1}/${unique.length}] ${s}: 失败 - ${d.message || 'unknown'}`);
      }
    } catch(e) {
      all.push({ symbol: s, error: e.message });
      fail++;
      console.log(`[${i+1}/${unique.length}] ${s}: 异常 - ${e.message}`);
    }
    // 每只间隔500ms防反爬
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n完成！成功: ${success}, 失败: ${fail}`);

  // 输出到页面（方便复制）
  const json = JSON.stringify(all, null, 2);
  const div = document.createElement('div');
  div.id = 'xq_kol_result';
  div.style.cssText = 'position:fixed;top:10px;left:10px;width:calc(100% - 20px);height:80vh;z-index:99999;background:#fff;border:2px solid #333;padding:10px;overflow:auto;font-size:12px;';
  const pre = document.createElement('pre');
  pre.textContent = json;
  pre.style.cssText = 'white-space:pre-wrap;word-break:break-all;';
  div.appendChild(pre);

  // 添加关闭按钮
  const btn = document.createElement('button');
  btn.textContent = '关闭并复制到剪贴板';
  btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:100000;padding:5px 10px;font-size:14px;cursor:pointer;background:#f00;color:#fff;';
  btn.onclick = () => {
    navigator.clipboard.writeText(json).then(() => {
      alert('已复制到剪贴板！');
    });
    div.remove();
    btn.remove();
  };
  document.body.appendChild(div);
  document.body.appendChild(btn);

  // 同时也存到localStorage
  localStorage.setItem('xq_kol_result', json);
  console.log('结果已保存到 localStorage["xq_kol_result"]，可用 copy(JSON.parse(localStorage.xq_kol_result)) 查看');
})()

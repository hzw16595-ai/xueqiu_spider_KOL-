// 在Chrome Console里执行这一行，把输出结果复制给我
// 这会导出雪球的所有cookie为JSON格式
JSON.stringify(document.cookie.split('; ').reduce(function(obj, c) {
    var parts = c.split('=');
    obj[parts[0]] = parts.slice(1).join('=');
    return obj;
}, {}))

/*
 * 讀取 data/ 底下的 CSV 與 JSON，組成引擎要的 SP5_DATA。
 * node 測試直接 require 這支；build 時也用它，把結果內嵌進 HTML。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data');

/* 簡單的 CSV：用逗號切欄位，只有最後一欄（來源說明）可以含逗號。
   不支援引號：遇到引號、或欄位數不足，就讓 build 失敗並指出檔案與行號（v0.8.1），
   避免格式不符的資料悄悄切錯欄位、錯的數字進到引擎 */
function csv(name, dir) {
  const lines = fs.readFileSync(path.join(dir || DIR, name), 'utf8').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  const fail = (n, why) => { throw new Error('data/' + name + ' 第 ' + (n + 2) + ' 行：' + why); };
  if (head.some((h) => h.includes('"'))) fail(-1, '標題列不能有引號');
  return lines.map((ln, n) => {
    if (ln.includes('"')) fail(n, '不支援引號（只有最後一欄可以含逗號，不用加引號）');
    const cells = ln.split(',');
    if (cells.length < head.length) fail(n, '欄位數 ' + cells.length + '，標題有 ' + head.length + ' 欄');
    const row = {};
    head.forEach((h, i) => {
      const v = i === head.length - 1 ? cells.slice(i).join(',') : cells[i];   // 最後一欄（來源）可含逗號
      row[h] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    });
    return row;
  });
}

module.exports = function loadData() {
  return {
    params: JSON.parse(fs.readFileSync(path.join(DIR, 'params.json'), 'utf8')),
    life: csv('life_expectancy.csv'),
    np: csv('np_premium.csv'),
    nhi: csv('nhi_premium.csv'),
    caps: csv('caps.csv'),
    lsGrades: csv('ls_wage_grades.csv'),
    liGrades: csv('li_wage_grades.csv'),
    deposit: csv('deposit_rate.csv'),
    nhiEmp: csv('nhi_employee.csv'),     /* v0.9.8：健保費率、投保金額最低與最高級（夫妻模式的眷屬保費） */
    npBen: csv('np_benefits.csv'),       /* v0.9.8：國保遺屬年金最低保障（每 4 年依 CPI 調整） */
    lsAnnuity: csv('ls_annuity.csv')     /* v0.9.9：勞退月退休金的年金化利率（與生命表同一個生效日） */
  };
};
module.exports.csv = csv;   // 測試用：可以指定資料夾

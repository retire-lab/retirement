/*
 * 讀取 data/ 底下的 CSV 與 JSON，組成引擎要的 SP5_DATA。
 * node 測試直接 require 這支；build 時也用它，把結果內嵌進 HTML。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data');

function csv(name) {
  const lines = fs.readFileSync(path.join(DIR, name), 'utf8').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  return lines.map((ln) => {
    const cells = ln.split(',');
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
    deposit: csv('deposit_rate.csv')
  };
};

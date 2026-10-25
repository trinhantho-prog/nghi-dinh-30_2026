// Representative Excel HTML clipboard: three header levels and eleven columns.
export const EXCEL_KCB_HTML = `<html><head><style>
<!--
table {border-collapse:collapse; font-size:10pt;}
.xl {font-size:10pt; font-family:"Times New Roman"; color:#000000; vertical-align:middle;}
.head {font-weight:700; text-align:center; background:#E7E6E6; white-space:normal;}
.num {text-align:right; background:#E7E6E6;}
-->
</style></head><body><table width="726" style="width:544.5pt">
<colgroup><col width="96" style="width:72pt"><col span="10" width="63" style="width:47.25pt"></colgroup>
<tr><td class="xl head" rowspan="3" style="text-align:left;background:white">Hình thức KCB</td><td class="xl head" colspan="4">Lượt KCB tại CSKCB</td><td class="xl head" colspan="2">Tỷ lệ gia tăng lượt KCB các CSKCB cùng cấp CMKT, điểm, cùng chuyên khoa TQ/Tỉnh</td><td class="xl head" colspan="4">Tiền tổng chi BH tại CSKCB</td></tr>
<tr><td class="xl head" rowspan="2">08T2025</td><td class="xl head" rowspan="2">08T2026</td><td class="xl head" colspan="2">So sánh 08T2026 với 08T2025</td><td class="xl head" rowspan="2">Toàn quốc</td><td class="xl head" rowspan="2">Tỉnh</td><td class="xl head" rowspan="2">08T2025</td><td class="xl head" rowspan="2">08T2026</td><td class="xl head" colspan="2">So sánh 08T2026 với 08T2025</td></tr>
<tr><td class="xl head">Tỷ lệ</td><td class="xl head">Số lượt tăng</td><td class="xl head">Tỷ lệ</td><td class="xl head">Số tiền tăng</td></tr>
<tr><td class="xl">3_KCB nội trú</td><td class="xl num">6,074</td><td class="xl num">7,078</td><td class="xl num">16.5%</td><td class="xl num">1,004</td><td class="xl num">2.5%</td><td class="xl num">3.3%</td><td class="xl num">14.36</td><td class="xl num">16.18</td><td class="xl num">12.7%</td><td class="xl num">1.82</td></tr>
<tr><td class="xl">1_Khám ngoại trú</td><td class="xl num">131,450</td><td class="xl num">126,764</td><td class="xl num">-3.6%</td><td class="xl num">-4,686</td><td class="xl num">-1.7%</td><td class="xl num">-3.8%</td><td class="xl num">25.26</td><td class="xl num">29.03</td><td class="xl num">14.9%</td><td class="xl num">3.77</td></tr>
</table></body></html>`

export const EXCEL_KCB_TABLE = {
  type: 'table' as const,
  rows: [
    ['Hình thức KCB', 'Lượt KCB tại CSKCB', '', '', '', 'Tỷ lệ gia tăng lượt KCB các CSKCB cùng cấp CMKT, điểm, cùng chuyên khoa TQ/Tỉnh', '', 'Tiền tổng chi BH tại CSKCB', '', '', ''],
    ['', '08T2025', '08T2026', 'So sánh 08T2026 với 08T2025', '', 'Toàn quốc', 'Tỉnh', '08T2025', '08T2026', 'So sánh 08T2026 với 08T2025', ''],
    ['', '', '', 'Tỷ lệ', 'Số lượt tăng', '', '', '', '', 'Tỷ lệ', 'Số tiền tăng'],
    ['3_KCB nội trú', '6,074', '7,078', '16.5%', '1,004', '2.5%', '3.3%', '14.36', '16.18', '12.7%', '1.82'],
    ['1_Khám ngoại trú', '131,450', '126,764', '-3.6%', '-4,686', '-1.7%', '-3.8%', '25.26', '29.03', '14.9%', '3.77'],
  ],
  merges: [
    { row: 0, column: 0, rowSpan: 3, colSpan: 1 }, { row: 0, column: 1, rowSpan: 1, colSpan: 4 }, { row: 0, column: 5, rowSpan: 1, colSpan: 2 }, { row: 0, column: 7, rowSpan: 1, colSpan: 4 },
    { row: 1, column: 1, rowSpan: 2, colSpan: 1 }, { row: 1, column: 2, rowSpan: 2, colSpan: 1 }, { row: 1, column: 3, rowSpan: 1, colSpan: 2 }, { row: 1, column: 5, rowSpan: 2, colSpan: 1 }, { row: 1, column: 6, rowSpan: 2, colSpan: 1 }, { row: 1, column: 7, rowSpan: 2, colSpan: 1 }, { row: 1, column: 8, rowSpan: 2, colSpan: 1 }, { row: 1, column: 9, rowSpan: 1, colSpan: 2 },
  ],
  fontSize: 10,
  sourceWidth: 726,
  columnWidths: [96, ...Array<number>(10).fill(63)].map(width => width / 726 * 100),
  cellStyles: Array.from({ length: 5 }, (_, row) => Array.from({ length: 11 }, (_, column) => ({ bold: row < 3, align: row < 3 ? 'center' as const : column ? 'right' as const : 'left' as const, verticalAlign: 'middle' as const, background: '#E7E6E6', fontSize: 10 }))),
}

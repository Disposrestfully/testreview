# 题库数据说明

`questions.json` 是独立题库，前端只通过 `./data/questions.json` 读取内容。新增或修改题目时保持以下字段不变：

- `id`: 稳定且唯一的题号，例如 `R101`。不要因排序变化而重用旧编号。
- `type`: 当前使用 `single`，表示单项选择题。
- `stem`: 题干。
- `options`: 固定为 5 个选项，每项包含 `key` 和 `text`。
- `answer`: 正确选项的 `key`，例如 `C`。
- `explanation`: 答案解析，应说明关键判题步骤，不只重复答案。
- `tags`: 字符串数组，用于检索或后续分类筛选。
- `difficulty`: `基础`、`中等`、`进阶` 或 `挑战`。
- `image`: 可选图片对象；无图片时为 `null`。

图片题结构：

```json
"image": {
  "src": "./assets/example.webp",
  "alt": "不包含答案线索的图片说明",
  "credit": "作者或机构",
  "license": "CC BY 4.0",
  "sourceUrl": "https://example.com/source"
}
```

修改后在站点目录运行：

```bash
node scripts/validate-questions.mjs
```

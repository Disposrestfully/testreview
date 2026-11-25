# 呼吸系统题库

这是一个不需要后端或第三方运行时依赖的静态题库。页面从 `data/questions.json` 读取题目，可部署到 GitHub Pages。仓库已经包含自动校验、构建和发布工作流。

## 本地预览

不要直接双击 `index.html`。浏览器会阻止页面从本地文件读取 JSON。

安装 Node.js 20 或更高版本后，在本目录运行：

```bash
npm run preview
```

然后打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。

## 题库结构

`data/questions.json` 可以直接是题目数组，也可以使用 `{ "questions": [...] }`。推荐直接使用数组：

```json
[
  {
    "id": "R001",
    "type": "single",
    "stem": "题干",
    "options": [
      { "key": "A", "text": "选项 A" },
      { "key": "B", "text": "选项 B" },
      { "key": "C", "text": "选项 C" },
      { "key": "D", "text": "选项 D" },
      { "key": "E", "text": "选项 E" }
    ],
    "answer": "A",
    "explanation": "解析内容",
    "tags": ["肺功能", "阻塞性通气功能障碍"],
    "difficulty": "基础"
  }
]
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 稳定编号，使用 `R` 加三位数字（如 `R001`、`R120`）。发布后不要复用或随意改变。 |
| `type` | 是 | `single` 为单选，`multiple` 为多选。 |
| `stem` | 是 | 题干纯文本。 |
| `options` | 是 | 选项数组。每项包含唯一的 `key` 与非空 `text`。 |
| `answer` | 是 | 单选用字符串，如 `"B"`；多选用数组，如 `["A", "C"]`。 |
| `explanation` | 是 | 详细解析。换行会显示为独立段落。 |
| `tags` | 是 | 至少一个考点标签。 |
| `difficulty` | 是 | `基础`、`中等`、`进阶` 或 `挑战`。按题号递进，不应从高难度退回低难度。 |
| `typeLabel` | 否 | 页面显示的题型，如 `A2 型单选题`；省略时显示 `单选题` 或 `多选题`。 |
| `image` | 否 | 题目图片对象，字段见下方。 |

带图片的题目可以增加：

```json
"image": {
  "src": "./assets/questions/R042.png",
  "alt": "右肺上叶可见厚壁空洞，内壁不规则",
  "credit": "图片作者或机构",
  "license": "CC BY 4.0",
  "sourceUrl": "https://example.org/source"
}
```

`src` 和 `alt` 必须同时存在。建议把图片存入 `assets/questions/`，使用相对路径，避免外部网站失效。`credit`、`license` 和 `sourceUrl` 可选，但使用第三方图片时应按授权要求填写。

## 新增或修改题目

1. 编辑 `data/questions.json`。
2. 新题使用尚未占用的稳定 ID；修改题目时保留原 ID。
3. 保证选项键唯一，`answer` 只引用已有选项键。
4. 难度按题号从 `基础`、`中等`、`进阶` 到 `挑战` 逐级递进。
5. 运行校验：

```bash
npm run check
```

校验通过后刷新页面即可。页面也兼容部分常见旧字段名，例如 `question`、`choices`、`correctAnswer` 和 `analysis`，但新题应统一使用上面的标准字段，避免维护分叉。

## 一键部署到 GitHub Pages

仓库内的 `.github/workflows/deploy-pages.yml` 会在每次推送到 `main` 后自动执行：

1. 校验 JavaScript 和 120 道题的数据结构。
2. 生成只包含运行文件的 `_site` 发布包。
3. 上传并部署到 GitHub Pages。

也可以在 GitHub 仓库的 `Actions` -> `Deploy GitHub Pages` 页面点击 `Run workflow` 手动重新部署。首次使用时，仓库 `Settings` -> `Pages` 的发布来源应为 `GitHub Actions`。

当前目标仓库为 `Disposrestfully/testreview`，对应地址：

```text
https://disposrestfully.github.io/testreview/
```

本地执行与线上相同的发布前检查：

```bash
npm run prepare-pages
```

所有资源都使用相对路径，因此项目站点（`用户名.github.io/仓库名/`）和用户站点（`用户名.github.io/`）都可以正常工作。

## 页面行为

- 顺序模式按稳定 ID 浏览。
- 随机模式保存本次随机顺序；再次点击“随机”可重新排列。
- 跳题支持输入 `R042` 或 `42`。
- 选择记录、当前题和随机顺序保存在浏览器本地。
- 每次进入新题时解析默认收起。
- 有图题可点击图片查看完整尺寸。

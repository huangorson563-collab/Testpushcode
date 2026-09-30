window.SITE_CONFIG = {
  title: "AI Blog",
  tagline: "Markdown 驱动的个人博客",
  description: "记录想法、代码和日常学习笔记。",
  author: "Your Name",
  nav: [
    { label: "文章", hash: "#/home" },
    { label: "关于", hash: "#/about" },
    { label: "管理", hash: "#/manage" }
  ],
  posts: [
    {
      id: "hello-blog",
      title: "欢迎来到我的博客",
      date: "2026-09-07",
      category: "Blog",
      summary: "这是一个基于纯前端实现的个人博客模板，内容来自 Markdown 文件。",
      file: "posts/hello-blog.md",
      content: "# 第一篇文章\n\n这是博客的起点。\n\n## 计划\n\n- 记录学习笔记\n- 分享项目实践\n- 保持更新频率\n\n## 一段代码\n\n```js\nconsole.log('hello blog');\n```"
    },
    {
      id: "frontend-notes",
      title: "前端静态站搭建笔记",
      date: "2026-08-31",
      category: "Notes",
      summary: "如何用 HTML、CSS 和 JavaScript 组合出一个可部署到 GitHub Pages 的博客。",
      file: "posts/frontend-notes.md",
      content: "# 前端静态站搭建笔记\n\n这个站点采用纯前端方案：\n\n1. `index.html` 作为入口\n2. `config.js` 管理站点信息和文章清单\n3. `posts/*.md` 存放正文\n4. `app.js` 负责路由和渲染\n\n这样的结构适合 GitHub Pages 和 EdgeOne Pages。"
    },
    {
      id: "writing-workflow",
      title: "我的写作工作流",
      date: "2026-08-20",
      category: "Workflow",
      summary: "从 Markdown 草稿到页面渲染，尽量让内容维护保持轻便。",
      file: "posts/writing-workflow.md",
      content: "# 我的写作工作流\n\n我习惯先写 Markdown 草稿，再决定是否补图、补代码块，最后交给前端渲染。\n\n## 优点\n\n- 维护简单\n- 便于版本管理\n- 迁移成本低"
    },
    {
      id: "jinse",
      title: "锦瑟",
      date: "2026-09-07",
      category: "Poetry",
      summary: "李商隐的《锦瑟》，收录到博客文章列表中。",
      file: "posts/jinse.md",
      content: "# 锦瑟\n\n锦瑟无端五十弦，一弦一柱思华年。\n\n庄生晓梦迷蝴蝶，望帝春心托杜鹃。\n\n沧海月明珠有泪，蓝田日暖玉生烟。\n\n此情可待成追忆，只是当时已惘然。"
    }
  ],
  about: {
    title: "关于我",
    intro: "这里可以放个人简介、技能栈、联系方式和长期关注的主题。",
    body: "我喜欢把想法写成可持续维护的网页，而不是依赖复杂后台。这个模板就是为此准备的。"
  }
};

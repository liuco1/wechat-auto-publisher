---
title: 一文讲透Playwright：从零搭建自动化测试的5个关键步骤
cover: ./covers/cover-test.png
---

# 一文讲透Playwright：从零搭建自动化测试的5个关键步骤

你是不是也有这样的经历：每天重复点击同一个页面、填写同一套表单、验证同一个流程？手动测试做久了，效率越来越低，bug却没少漏。这时候，自动化测试就是你的"出路"。

在 Selenium、Cypress、Playwright 这些框架里，**Playwright** 是近几年最耀眼的新星——微软出品、跨浏览器支持、自动等待机制、API简洁优雅。今天，我就带你从零开始，5个步骤搞定 Playwright 自动化测试。

---

## 步骤一：环境搭建——三分钟开箱即用

Playwright 的安装极其简单，只需要两步：

```bash
# 第1步：初始化项目
mkdir my-test-project && cd my-test-project
npm init -y

# 第2步：安装 Playwright
npm install @playwright/test
npx playwright install
```

`npx playwright install` 会自动下载 Chromium、Firefox 和 WebKit 三个浏览器引擎，无需你手动配置。这就意味着——**一个项目，三套浏览器，零额外安装**。

安装完成后，创建配置文件 `playwright.config.ts`：

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
});
```

> **小白提示**：`headless: true` 表示不弹出浏览器窗口，在后台静默运行。调试时改成 `false`，你可以亲眼看到每一步操作。

---

## 步骤二：写第一个测试——比你想的简单得多

创建 `tests/login.spec.ts`，写一个最典型的登录测试：

```typescript
import { test, expect } from '@playwright/test';

test('用户登录成功', async ({ page }) => {
  // 1. 打开登录页
  await page.goto('/login');

  // 2. 输入账号密码
  await page.fill('#username', 'testuser');
  await page.fill('#password', '123456');

  // 3. 点击登录按钮
  await page.click('#login-btn');

  // 4. 验证跳转到首页
  await expect(page).toHaveURL('/home');

  // 5. 验证欢迎文案
  await expect(page.locator('.welcome')).toContainText('欢迎回来');
});
```

看到没？**5行核心代码，覆盖了完整的登录流程**。`fill`、`click`、`expect`——每个方法都直白明了，不需要翻文档猜参数。

---

## 步骤三：搞定自动等待——再也不用 sleep 了

Selenium 时代最头疼的问题就是"元素还没加载出来就操作了"，于是大家到处写 `sleep(3)`、`sleep(5)`。Playwright 用**自动等待**彻底解决了这个问题：

```typescript
// Playwright 会自动等待元素可点击才执行点击
await page.click('#submit-btn');

// 断言也自带等待——最多等5秒直到条件满足
await expect(page.locator('.result')).toBeVisible();
```

原理是：Playwright 在执行每个操作前，会自动检查目标元素是否**可见、可交互、稳定**（不在动画中）。如果条件不满足，它会耐心等待直到超时。

这意味着你再也不需要写这种代码了：

```javascript
// ❌ Selenium 时代的痛苦写法
driver.findElement(By.id("submit")).then(el => {
  setTimeout(() => el.click(), 3000); // 盲等，永远不知道3秒够不够
});
```

> **关键技巧**：如果某个元素确实需要更长时间才出现，用 `expect` 的自定义超时：
> ```typescript
> await expect(page.locator('.slow-element')).toBeVisible({ timeout: 10000 });
> ```

---

## 步骤四：跨浏览器测试——一份代码跑三家

这是 Playwright 最硬核的优势。只需在配置文件中声明浏览器列表：

```typescript
export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox',  use: { browserName: 'firefox' } },
    { name: 'webkit',   use: { browserName: 'webkit' } },
  ],
});
```

运行 `npx playwright test` 时，**每个测试会自动在三个浏览器上各跑一遍**。你写一份代码，就能验证 Chrome、Firefox、Safari 三端的兼容性。

如果你只想在某个浏览器上调试，可以这样：

```bash
npx playwright test --project=chromium
```

---

## 步骤五：调试与报告——让 bug 无处藏身

测试跑完了，怎么知道哪步出了问题？Playwright 提供了三种调试利器：

**1. Trace Viewer（回放录像）**

```bash
npx playwright test --trace on
```

运行后打开 `npx playwright show-trace`，你可以像看视频一样**回放每一步操作**——页面截图、DOM状态、网络请求、控制台日志，全都有。

**2. Codegen（自动生成代码）**

```bash
npx playwright codegen http://localhost:3000
```

打开这个命令后，Playwright 会启动浏览器，你在页面上做的每一步操作，都会**自动转成测试代码**。对新手来说，这是最快的学习方式——先"录"再"改"。

**3. HTML Report（可视化报告）**

```bash
npx playwright show-report
```

一份精美的 HTML 报告，包含每个测试的通过/失败状态、耗时、截图、甚至失败时的完整 trace。发给团队，谁都能看懂。

---

## 实战避坑：三个常见错误

刚上手 Playwright 时，这三坑踩得最多：

1. **用 `page.waitForTimeout()` 等待**——虽然 Playwright 提供了这个方法，但它是硬等待，和 `sleep` 一样不可靠。尽量用 `expect` 的自动等待替代。

2. **选择器写得太脆弱**——`page.locator('div > div > span:nth-child(3)')` 这种层级选择器，页面稍有改动就挂。优先用 `data-testid`：
   ```html
   <button data-testid="login-btn">登录</button>
   ```
   ```typescript
   await page.click('[data-testid="login-btn"]');
   ```

3. **忘记关闭上下文**——每个测试用 `async ({ page })` 自动管理，但如果你自己创建了 `browser.newContext()`，记得手动关闭，否则内存泄漏。

---

## 总结：为什么 Playwright 是入门首选？

| 特性 | Selenium | Playwright |
|------|----------|------------|
| 自动等待 | ❌ 需手动 | ✅ 内置 |
| 跨浏览器安装 | ❌ 各自配置 | ✅ 一键下载 |
| API简洁度 | 中等 | ✅ 极简 |
| Trace回放 | ❌ 无 | ✅ 内置 |
| 并行执行 | 需配置 | ✅ 默认支持 |

如果你是初学者或职业院校学生，**Playwright 就是当前最好的入门框架**——学习成本低、上手快、调试体验好。别再纠结"该学哪个"，直接开箱，写第一个测试，你会立刻感受到自动化的魅力。

下一步，试着把你工作中最常手动执行的流程，用 Playwright 写成自动化脚本。你会发现——**自动化测试不是负担，而是你下班早走的理由**。

关注「润木学堂」，获取更多软件测试干货！

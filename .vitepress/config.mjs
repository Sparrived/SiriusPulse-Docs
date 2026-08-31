import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Sirius Pulse',
  description: '异步角色扮演聊天框架 — 支持多人格、多平台、多模型',

  lastUpdated: true,
  cleanUrls: true,

  themeConfig: {
    logo: '/yuebai.png',

    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/', activeMatch: '/guide/' },
      { text: '扩展开发', link: '/extensions/', activeMatch: '/extensions/' },
      { text: '参考', link: '/reference/', activeMatch: '/reference/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/quickstart' },
            { text: '安装', link: '/guide/installation' },
            { text: 'Docker 部署', link: '/guide/docker-deployment' },
            { text: '配置', link: '/guide/configuration' },
          ],
        },
        {
          text: '核心概念',
          items: [
            { text: '人格系统', link: '/guide/persona-system' },
            { text: '系统架构全景', link: '/guide/architecture-overview' },
            { text: '引擎架构', link: '/guide/engine-architecture' },
            { text: '记忆系统', link: '/guide/memory-system' },
          ],
        },
        {
          text: '平台接入',
          items: [
            { text: 'NapCat / OneBot', link: '/guide/platform-napcat' },
          ],
        },
      ],
      '/extensions/': [
        {
          text: '工具系统 (Tools)',
          items: [
            { text: '工具系统总览', link: '/extensions/tool-overview' },
            { text: '编写自定义工具', link: '/extensions/tool-authoring' },
            { text: '内置工具参考', link: '/extensions/tool-builtin' },
            { text: '被动工具开发', link: '/extensions/tool-passive' },
          ],
        },
        {
          text: '插件系统 (Plugins)',
          items: [
            { text: '插件系统总览', link: '/extensions/plugin-overview' },
            { text: 'GitHub Monitor 外部插件', link: '/extensions/github-monitor' },
            { text: '编写自定义插件', link: '/extensions/plugin-authoring' },
            { text: '指令系统详解', link: '/extensions/plugin-command' },
            { text: '生命周期与上下文', link: '/extensions/plugin-lifecycle' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '配置参考',
          items: [
            { text: '全局配置', link: '/reference/global-config' },
            { text: '人格配置', link: '/reference/persona-config' },
            { text: 'Provider 配置', link: '/reference/provider-config' },
          ],
        },
        {
          text: 'API 参考',
          items: [
            { text: 'Python API', link: '/reference/python-api' },
            { text: 'WebUI API', link: '/reference/webui-api' },
            { text: 'Tools API', link: '/reference/tools-api' },
            { text: 'Plugins API', link: '/reference/plugins-api' },
            { text: 'AI API 参考', link: '/reference/ai-api' },
            { text: 'Brain API', link: '/reference/brain-api' },
          ],
        },
        {
          text: '开发',
          items: [
            { text: '开发指南', link: '/reference/development' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sparrived/SiriusPulse' },
    ],

    editLink: {
      pattern: 'https://github.com/Sparrived/SiriusPulse-Doc/edit/master/:path',
      text: '在 GitHub 上编辑此页',
    },

    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2025-2026 Sparrived',
    },
  },
})

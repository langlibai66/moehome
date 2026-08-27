/**
 * MoeWah Homepage Configuration
 * 所有可配置内容集中管理，便于维护和更新
 */

window.HOMEPAGE_CONFIG = {
    site: {
        name: "晨旭不想写程序",
        tagline: "技术爱好者",
        url: "",
        ogImage: "/images/avatar.jpg"
    },
    seo: {
        title: "晨旭不想写程序 - 个人主页",
        description: "欢迎访问晨旭不想写程序的个人主页",
        keywords: [
            "杨晨旭",
            "个人主页",
            "开发者"
        ],
        og: {
            title: "晨旭不想写程序 - 个人主页",
            description: "开发者 / 技术爱好者",
            image: ""
        }
    },
    pages: {
        404: {
            title: "页面未找到",
            description: "抱歉，您访问的页面不存在或已被删除",
            robots: "noindex, nofollow"
        },
        moments: {
            title: "动态",
            icon: "fa-solid fa-bolt",
            tagline: "我的碎片化分享，记录生活点滴与瞬间感悟。",
            description: "个人动态，记录生活点滴",
            keywords: [
                "动态",
                "瞬间"
            ]
        },
        guestbook: {
            title: "留言",
            icon: "fa-solid fa-comments",
            tagline: "欢迎在这里留下你的足迹。",
            description: "留言板",
            keywords: [
                "留言板"
            ]
        }
    },
    theme: {
        default: "light",
        defaultScheme: {
            light: "nordSnowStorm",
            dark: "catppuccinMocha"
        }
    },
    nav: {
        enabled: true,
        brand: {
            showPrompt: true,
            hoverText: "~/whoami"
        },
        menus: []
    },
    profile: {
        name: "晨旭不想写程序",
        tagline: {
            prefix: "🐱",
            highlight: "欢迎来到我的主页"
        },
        avatar: "/images/avatar.png"
    },
    favicon: {
        path: ""
    },
    identity: [
        "Hi, I'm 杨晨旭.",
        "CS研",
        "技术爱好者"
    ],
    interests: [
        "人工智能",
        "技术分享",
        "开源项目"
    ],
    gear: [],
    terminal: {
        title: "🐱 user@host:~|",
        prompts: [
            {
                command: "whoami",
                output: "identity"
            },
            {
                command: "cat interests.txt",
                output: "interests"
            },
            {
                command: "./wisdom.sh",
                output: "dynamic"
            }
        ]
    },
    quotes: [
        "Stay hungry, stay foolish.",
        "Talk is cheap. Show me the code.",
        "Simplicity is the ultimate sophistication.",
        "The best way to predict the future is to invent it."
    ],
    music: {
        enabled: false,
        volume: 0.5,
        autoplay: false,
        playMode: "list",
        mode: "meting",
        meting: {
            server: "netease",
            type: "playlist",
            id: "",
            apis: []
        },
        local: []
    },
    animation: {
        fadeInDelay: 1000,
        typingSpeed: 60,
        quoteDisplayTime: 4000,
        quoteDeleteSpeed: 42
    },
    rss: {
        enabled: false,
        url: "https://yourblog.com/rss.xml",
        count: 4,
        openInNewTab: true,
        title: {
            text: "近期更新",
            icon: "fa-solid fa-newspaper"
        },
        display: {
            showDate: true,
            showDescription: true,
            maxDescriptionLength: 100
        }
    },
    projects: {
        enabled: false,
        title: {
            text: "我的项目",
            icon: "fa-solid fa-folder-open"
        },
        githubUser: "https://github.com/langlibai66",
        count: 6,
        exclude: [
            ".github"
        ]
    },
    contribution: {
        enabled: false,
        useRealData: false,
        githubUser: "https://github.com/langlibai66"
    },
    moments: {
        enabled: false,
        memosUrl: "",
        count: 10,
        tags: [],
        showSkeleton: true
    },
    guestbook: {
        enabled: false,
        provider: "waline",
        server: "",
        site: "MoeHome",
        placeholder: "欢迎留下你的信号...",
        limits: {
            comments: {
                newest: 30,
                hot: 30
            },
            barrage: {
                pinned: 5,
                hot: 10,
                latest: 5
            }
        }
    },
    linksConfig: {
        enabled: true,
        title: {
            text: "链接导航",
            icon: "fa-solid fa-link"
        }
    },
    links: [
        {
            name: "简历",
            description: "我的在线简历",
            url: "/resume",
            icon: "fa-solid fa-file-lines",
            brand: "resume",
            external: false,
            color: "#6366f1",
            enabled: true
        },
        {
            name: "GitHub",
            description: "开源项目 & 代码",
            url: "https://github.com/langlibai66",
            icon: "fa-brands fa-github",
            brand: "github",
            external: true,
            color: "#58a6ff",
            enabled: true
        },
        {
            name: "Email",
            description: "联系我",
            url: "aiyangcx@gmail.com",
            icon: "fa-solid fa-envelope",
            brand: "email",
            external: false,
            color: "#ea4335",
            antiCrawler: true,
            enabled: true
        },
        {
            name: "小红书",
            description: "我的小红书主页",
            url: "https://www.xiaohongshu.com/user/profile/62ee3371000000001f015396",
            icon: "fa-solid fa-book-open",
            brand: "xiaohongshu",
            external: true,
            color: "#fe2c55",
            enabled: true
        },
        {
            name: "博客",
            description: "我的个人博客",
            url: "https://blog.aaaieee.cn/",
            icon: "fa-solid fa-pen-nib",
            brand: "blog",
            external: true,
            color: "#00ff9f",
            enabled: true
        }
    ],
    donation: {
        enabled: false,
        title: {
            text: "赞助支持",
            icon: "fa-solid fa-mug-hot"
        },
        message: "",
        methods: []
    },
    footer: {
        copyright: {
            year: "2026",
            name: "AAAIEEE",
            url: ""
        },
        icp: {
            enabled: false,
            number: "",
            url: "https://beian.miit.gov.cn/"
        }
    },
    notice: {
        enabled: false,
        type: "warning",
        icon: "fa-solid fa-shield-halved",
        text: ""
    },
    analytics: {
        googleAnalytics: {
            enabled: false,
            id: ""
        },
        microsoftClarity: {
            enabled: false,
            id: ""
        },
        umami: "",
        customScripts: []
    }
};

function formatIdentity() { return window.HOMEPAGE_CONFIG.identity.join(" / "); }
function formatInterests() { return window.HOMEPAGE_CONFIG.interests.join(" / "); }
/* Sheldon language selector – anchored dropdown + persisted choice + strings.
 * Add data-i18n="key" to any element to have its text replaced on language
 * change. Add data-i18n-ph="key" to inputs for placeholder translation.
 * Language buttons: any element with [data-lang-btn] toggles the dropdown.
 * Current-language labels: any <span data-lang-current> is kept in sync.
 * Choice persists in localStorage under 'sheldon_lang' (default 'en').
 */
(function ()
{
    const STORE_KEY = 'sheldon_lang';

    const LANGS = [
        { code: 'en', native: 'English',    english: 'English',    region: 'United States' },
        { code: 'de', native: 'Deutsch',    english: 'German',     region: 'Deutschland' },
        { code: 'es', native: 'Español',    english: 'Spanish',    region: 'España' },
        { code: 'fr', native: 'Français',   english: 'French',     region: 'France' },
        { code: 'pt', native: 'Português',  english: 'Portuguese', region: 'Portugal' },
        { code: 'ru', native: 'Русский',     english: 'Russian',    region: 'Россия' },
        { code: 'tr', native: 'Türkçe',      english: 'Turkish',    region: 'Türkiye' },
        { code: 'zh', native: '中文 (简体)', english: 'Chinese',    region: '中国' },
        { code: 'ja', native: '日本語',      english: 'Japanese',   region: '日本' },
        { code: 'ko', native: '한국어',      english: 'Korean',     region: '한국' },
        { code: 'it', native: 'Italiano',    english: 'Italian',    region: 'Italia' },
        { code: 'pl', native: 'Polski',      english: 'Polish',     region: 'Polska' },
        { code: 'ar', native: 'العربية',     english: 'Arabic',     region: 'الشرق الأوسط' },
    ];

    // Languages written right-to-left – page direction flips while active.
    const RTL_LANGS = ['ar'];

    const STRINGS = {
        en: {
            'lang.title': 'Select language', 'lang.search': 'Search language',
            'nav.product': 'Product', 'nav.docs': 'Documentation', 'nav.download': 'Download',
            'nav.pricing': 'Pricing', 'nav.community': 'Community',
            'nav.product.overview.t': 'Overview', 'nav.product.overview.s': 'Get Sheldon today',
            'nav.docs.luavm.t': 'Lua VM docs', 'nav.docs.luavm.s': 'Guides and reference',
            'nav.product.terms.t': 'Terms of Service', 'nav.product.terms.s': 'Usage agreement',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Download for Windows',
            'nav.download.dash.t': 'Dashboard', 'nav.download.dash.s': 'Keys and account',
            'nav.product.status.t': 'Status', 'nav.product.status.s': 'Service health',
            'nav.pricing.plans.t': 'Plans', 'nav.pricing.plans.s': 'Compare licenses',
            'nav.pricing.resellers.t': 'Resellers', 'nav.pricing.resellers.s': 'Verified sellers',
            'nav.community.discord.t': 'Discord server', 'nav.community.discord.s': 'Chat and support',
            'nav.community.guides.t': 'Guides', 'nav.community.guides.s': 'Step-by-step tutorials',
            'hero.subtitle': 'Get Project Sheldon today - Best & Only Freemium External.',
            'hero.download': 'Download for Windows', 'hero.pricing': 'See pricing',
            'hero.terms.pre': 'Using Sheldon means you agree to the',
            'hero.terms.link': 'Terms of Service', 'hero.terms.post': '',
            'lang.language': 'Language',
            'guides.title': 'Guides',
            'guides.subtitle': 'Step-by-step tutorials for Project Sheldon.',
            'guides.search': 'Search guides…',
            'guides.all': 'All',
            'guides.back': 'All guides',
            'guides.empty.t': 'No guides found',
            'guides.empty.s': 'Try a different search or category.',
            'guides.error.t': 'Couldn\'t load guides',
            'guides.error.s': 'The servers aren\'t reachable right now.',
            'guides.retry': 'Retry',
        },
        de: {
            'lang.title': 'Sprache wählen', 'lang.search': 'Sprache suchen',
            'nav.product': 'Produkt', 'nav.docs': 'Dokumentation', 'nav.download': 'Download',
            'nav.pricing': 'Preise', 'nav.community': 'Community',
            'nav.product.overview.t': 'Übersicht', 'nav.product.overview.s': 'Hol dir Sheldon noch heute',
            'nav.docs.luavm.t': 'Lua-VM-Docs', 'nav.docs.luavm.s': 'Anleitungen und Referenz',
            'nav.product.terms.t': 'Nutzungsbedingungen', 'nav.product.terms.s': 'Nutzungsvereinbarung',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Download für Windows',
            'nav.download.dash.t': 'Dashboard', 'nav.download.dash.s': 'Keys und Konto',
            'nav.product.status.t': 'Status', 'nav.product.status.s': 'Dienststatus',
            'nav.pricing.plans.t': 'Pläne', 'nav.pricing.plans.s': 'Lizenzen vergleichen',
            'nav.pricing.resellers.t': 'Reseller', 'nav.pricing.resellers.s': 'Verifizierte Händler',
            'nav.community.discord.t': 'Discord-Server', 'nav.community.discord.s': 'Chat und Support',
            'nav.community.guides.t': 'Anleitungen', 'nav.community.guides.s': 'Schritt-für-Schritt-Tutorials',
            'hero.subtitle': 'Hol dir Project Sheldon noch heute – das beste und einzige Freemium External.',
            'hero.download': 'Download für Windows', 'hero.pricing': 'Preise ansehen',
            'hero.terms.pre': 'Mit der Nutzung von Sheldon stimmst du den',
            'hero.terms.link': 'Nutzungsbedingungen', 'hero.terms.post': 'zu',
            'lang.language': 'Sprache',
            'guides.title': 'Anleitungen',
            'guides.subtitle': 'Schritt-für-Schritt-Anleitungen für Project Sheldon.',
            'guides.search': 'Anleitungen suchen…',
            'guides.all': 'Alle',
            'guides.back': 'Alle Anleitungen',
            'guides.empty.t': 'Keine Anleitungen gefunden',
            'guides.empty.s': 'Versuche eine andere Suche oder Kategorie.',
            'guides.error.t': 'Anleitungen konnten nicht geladen werden',
            'guides.error.s': 'Die Server sind gerade nicht erreichbar.',
            'guides.retry': 'Erneut versuchen',
        },
        es: {
            'lang.title': 'Seleccionar idioma', 'lang.search': 'Buscar idioma',
            'nav.product': 'Producto', 'nav.docs': 'Documentación', 'nav.download': 'Descargar',
            'nav.pricing': 'Precios', 'nav.community': 'Comunidad',
            'nav.product.overview.t': 'Resumen', 'nav.product.overview.s': 'Obtén Sheldon hoy',
            'nav.docs.luavm.t': 'Docs de Lua VM', 'nav.docs.luavm.s': 'Guías y referencia',
            'nav.product.terms.t': 'Términos del servicio', 'nav.product.terms.s': 'Acuerdo de uso',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Descargar para Windows',
            'nav.download.dash.t': 'Panel', 'nav.download.dash.s': 'Claves y cuenta',
            'nav.product.status.t': 'Estado', 'nav.product.status.s': 'Salud del servicio',
            'nav.pricing.plans.t': 'Planes', 'nav.pricing.plans.s': 'Compara licencias',
            'nav.pricing.resellers.t': 'Revendedores', 'nav.pricing.resellers.s': 'Vendedores verificados',
            'nav.community.discord.t': 'Servidor de Discord', 'nav.community.discord.s': 'Chat y soporte',
            'nav.community.guides.t': 'Guías', 'nav.community.guides.s': 'Tutoriales paso a paso',
            'hero.subtitle': 'Obtén Project Sheldon hoy: el mejor y único freemium External.',
            'hero.download': 'Descargar para Windows', 'hero.pricing': 'Ver precios',
            'hero.terms.pre': 'Al usar Sheldon aceptas los',
            'hero.terms.link': 'Términos del servicio', 'hero.terms.post': '',
            'lang.language': 'Idioma',
            'guides.title': 'Guías',
            'guides.subtitle': 'Tutoriales paso a paso para Project Sheldon.',
            'guides.search': 'Buscar guías…',
            'guides.all': 'Todas',
            'guides.back': 'Todas las guías',
            'guides.empty.t': 'No se encontraron guías',
            'guides.empty.s': 'Prueba otra búsqueda o categoría.',
            'guides.error.t': 'No se pudieron cargar las guías',
            'guides.error.s': 'Los servidores no están disponibles ahora mismo.',
            'guides.retry': 'Reintentar',
        },
        fr: {
            'lang.title': 'Choisir la langue', 'lang.search': 'Rechercher une langue',
            'nav.product': 'Produit', 'nav.docs': 'Documentation', 'nav.download': 'Télécharger',
            'nav.pricing': 'Tarifs', 'nav.community': 'Communauté',
            'nav.product.overview.t': 'Aperçu', 'nav.product.overview.s': "Obtiens Sheldon dès aujourd'hui",
            'nav.docs.luavm.t': 'Docs Lua VM', 'nav.docs.luavm.s': 'Guides et référence',
            'nav.product.terms.t': "Conditions d'utilisation", 'nav.product.terms.s': "Accord d'utilisation",
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Télécharger pour Windows',
            'nav.download.dash.t': 'Tableau de bord', 'nav.download.dash.s': 'Clés et compte',
            'nav.product.status.t': 'Statut', 'nav.product.status.s': 'État du service',
            'nav.pricing.plans.t': 'Formules', 'nav.pricing.plans.s': 'Compare les licences',
            'nav.pricing.resellers.t': 'Revendeurs', 'nav.pricing.resellers.s': 'Vendeurs vérifiés',
            'nav.community.discord.t': 'Serveur Discord', 'nav.community.discord.s': 'Chat et assistance',
            'nav.community.guides.t': 'Guides', 'nav.community.guides.s': 'Tutoriels pas à pas',
            'hero.subtitle': "Obtiens Project Sheldon dès aujourd'hui – le meilleur et seul freemium External.",
            'hero.download': 'Télécharger pour Windows', 'hero.pricing': 'Voir les tarifs',
            'hero.terms.pre': 'En utilisant Sheldon, tu acceptes les',
            'hero.terms.link': "Conditions d'utilisation", 'hero.terms.post': '',
            'lang.language': 'Langue',
            'guides.title': 'Guides',
            'guides.subtitle': 'Tutoriels pas à pas pour Project Sheldon.',
            'guides.search': 'Rechercher des guides…',
            'guides.all': 'Tous',
            'guides.back': 'Tous les guides',
            'guides.empty.t': 'Aucun guide trouvé',
            'guides.empty.s': 'Essayez une autre recherche ou catégorie.',
            'guides.error.t': 'Impossible de charger les guides',
            'guides.error.s': 'Les serveurs sont injoignables pour le moment.',
            'guides.retry': 'Réessayer',
        },
        pt: {
            'lang.title': 'Selecionar idioma', 'lang.search': 'Pesquisar idioma',
            'nav.product': 'Produto', 'nav.docs': 'Documentação', 'nav.download': 'Download',
            'nav.pricing': 'Preços', 'nav.community': 'Comunidade',
            'nav.product.overview.t': 'Visão geral', 'nav.product.overview.s': 'Obtém o Sheldon hoje',
            'nav.docs.luavm.t': 'Docs da Lua VM', 'nav.docs.luavm.s': 'Guias e referência',
            'nav.product.terms.t': 'Termos de Serviço', 'nav.product.terms.s': 'Acordo de utilização',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Download para Windows',
            'nav.download.dash.t': 'Painel', 'nav.download.dash.s': 'Chaves e conta',
            'nav.product.status.t': 'Estado', 'nav.product.status.s': 'Saúde do serviço',
            'nav.pricing.plans.t': 'Planos', 'nav.pricing.plans.s': 'Compara licenças',
            'nav.pricing.resellers.t': 'Revendedores', 'nav.pricing.resellers.s': 'Vendedores verificados',
            'nav.community.discord.t': 'Servidor do Discord', 'nav.community.discord.s': 'Chat e suporte',
            'nav.community.guides.t': 'Guias', 'nav.community.guides.s': 'Tutoriais passo a passo',
            'hero.subtitle': 'Obtém o Project Sheldon hoje – o melhor e único freemium External.',
            'hero.download': 'Download para Windows', 'hero.pricing': 'Ver preços',
            'hero.terms.pre': 'Ao usar o Sheldon, concordas com os',
            'hero.terms.link': 'Termos de Serviço', 'hero.terms.post': '',
            'lang.language': 'Idioma',
            'guides.title': 'Guias',
            'guides.subtitle': 'Tutoriais passo a passo para o Project Sheldon.',
            'guides.search': 'Pesquisar guias…',
            'guides.all': 'Todos',
            'guides.back': 'Todos os guias',
            'guides.empty.t': 'Nenhum guia encontrado',
            'guides.empty.s': 'Tente outra pesquisa ou categoria.',
            'guides.error.t': 'Não foi possível carregar os guias',
            'guides.error.s': 'Os servidores não estão acessíveis no momento.',
            'guides.retry': 'Tentar novamente',
        },
        ru: {
            'lang.title': 'Выбрать язык', 'lang.search': 'Найти язык',
            'nav.product': 'Продукт', 'nav.docs': 'Документация', 'nav.download': 'Скачать',
            'nav.pricing': 'Цены', 'nav.community': 'Сообщество',
            'nav.product.overview.t': 'Обзор', 'nav.product.overview.s': 'Получи Sheldon сегодня',
            'nav.docs.luavm.t': 'Доки Lua VM', 'nav.docs.luavm.s': 'Гайды и справочник',
            'nav.product.terms.t': 'Условия использования', 'nav.product.terms.s': 'Пользовательское соглашение',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Скачать для Windows',
            'nav.download.dash.t': 'Панель', 'nav.download.dash.s': 'Ключи и аккаунт',
            'nav.product.status.t': 'Статус', 'nav.product.status.s': 'Состояние сервиса',
            'nav.pricing.plans.t': 'Тарифы', 'nav.pricing.plans.s': 'Сравнение лицензий',
            'nav.pricing.resellers.t': 'Реселлеры', 'nav.pricing.resellers.s': 'Проверенные продавцы',
            'nav.community.discord.t': 'Discord-сервер', 'nav.community.discord.s': 'Чат и поддержка',
            'nav.community.guides.t': 'Гайды', 'nav.community.guides.s': 'Пошаговые инструкции',
            'hero.subtitle': 'Получи Project Sheldon сегодня – лучший и единственный Freemium External.',
            'hero.download': 'Скачать для Windows', 'hero.pricing': 'Смотреть цены',
            'hero.terms.pre': 'Используя Sheldon, ты принимаешь',
            'hero.terms.link': 'Условия использования', 'hero.terms.post': '',
            'lang.language': 'Язык',
            'guides.title': 'Руководства',
            'guides.subtitle': 'Пошаговые руководства для Project Sheldon.',
            'guides.search': 'Поиск руководств…',
            'guides.all': 'Все',
            'guides.back': 'Все руководства',
            'guides.empty.t': 'Руководства не найдены',
            'guides.empty.s': 'Попробуйте другой запрос или категорию.',
            'guides.error.t': 'Не удалось загрузить руководства',
            'guides.error.s': 'Серверы сейчас недоступны.',
            'guides.retry': 'Повторить',
        },
        tr: {
            'lang.title': 'Dil seç', 'lang.search': 'Dil ara',
            'nav.product': 'Ürün', 'nav.docs': 'Belgeler', 'nav.download': 'İndir',
            'nav.pricing': 'Fiyatlar', 'nav.community': 'Topluluk',
            'nav.product.overview.t': 'Genel bakış', 'nav.product.overview.s': "Sheldon'ı hemen edin",
            'nav.docs.luavm.t': 'Lua VM belgeleri', 'nav.docs.luavm.s': 'Rehberler ve referans',
            'nav.product.terms.t': 'Kullanım Şartları', 'nav.product.terms.s': 'Kullanım sözleşmesi',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Windows için indir',
            'nav.download.dash.t': 'Panel', 'nav.download.dash.s': 'Anahtarlar ve hesap',
            'nav.product.status.t': 'Durum', 'nav.product.status.s': 'Servis durumu',
            'nav.pricing.plans.t': 'Planlar', 'nav.pricing.plans.s': 'Lisansları karşılaştır',
            'nav.pricing.resellers.t': 'Satıcılar', 'nav.pricing.resellers.s': 'Onaylı satıcılar',
            'nav.community.discord.t': 'Discord sunucusu', 'nav.community.discord.s': 'Sohbet ve destek',
            'nav.community.guides.t': 'Rehberler', 'nav.community.guides.s': 'Adım adım öğreticiler',
            'hero.subtitle': "Project Sheldon'ı hemen edin – en iyi ve tek freemium External.",
            'hero.download': 'Windows için indir', 'hero.pricing': 'Fiyatları gör',
            'hero.terms.pre': "Sheldon'ı kullanarak",
            'hero.terms.link': "Kullanım Şartları'nı", 'hero.terms.post': 'kabul etmiş olursun',
            'lang.language': 'Dil',
            'guides.title': 'Rehberler',
            'guides.subtitle': 'Project Sheldon için adım adım anlatımlar.',
            'guides.search': 'Rehber ara…',
            'guides.all': 'Tümü',
            'guides.back': 'Tüm rehberler',
            'guides.empty.t': 'Rehber bulunamadı',
            'guides.empty.s': 'Farklı bir arama veya kategori deneyin.',
            'guides.error.t': 'Rehberler yüklenemedi',
            'guides.error.s': 'Sunucular şu anda erişilemez durumda.',
            'guides.retry': 'Tekrar dene',
        },
        zh: {
            'lang.title': '选择语言', 'lang.search': '搜索语言',
            'nav.product': '产品', 'nav.docs': '文档', 'nav.download': '下载',
            'nav.pricing': '价格', 'nav.community': '社区',
            'nav.product.overview.t': '概览', 'nav.product.overview.s': '立即获取 Sheldon',
            'nav.docs.luavm.t': 'Lua VM 文档', 'nav.docs.luavm.s': '指南与参考',
            'nav.product.terms.t': '服务条款', 'nav.product.terms.s': '使用协议',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Windows 版下载',
            'nav.download.dash.t': '控制台', 'nav.download.dash.s': '密钥与账户',
            'nav.product.status.t': '状态', 'nav.product.status.s': '服务运行状况',
            'nav.pricing.plans.t': '套餐', 'nav.pricing.plans.s': '对比许可证',
            'nav.pricing.resellers.t': '经销商', 'nav.pricing.resellers.s': '认证卖家',
            'nav.community.discord.t': 'Discord 服务器', 'nav.community.discord.s': '聊天与支持',
            'nav.community.guides.t': '指南', 'nav.community.guides.s': '分步教程',
            'hero.subtitle': '立即获取 Project Sheldon –– 最佳且唯一的 Freemium External。',
            'hero.download': '下载 Windows 版', 'hero.pricing': '查看价格',
            'hero.terms.pre': '使用 Sheldon 即表示你同意',
            'hero.terms.link': '服务条款', 'hero.terms.post': '',
            'lang.language': '语言',
            'guides.title': '指南',
            'guides.subtitle': 'Project Sheldon 分步教程。',
            'guides.search': '搜索指南…',
            'guides.all': '全部',
            'guides.back': '全部指南',
            'guides.empty.t': '未找到指南',
            'guides.empty.s': '请尝试其他搜索词或分类。',
            'guides.error.t': '无法加载指南',
            'guides.error.s': '服务器当前无法访问。',
            'guides.retry': '重试',
        },
        ja: {
            'lang.title': '言語を選択', 'lang.search': '言語を検索',
            'nav.product': '製品', 'nav.docs': 'ドキュメント', 'nav.download': 'ダウンロード',
            'nav.pricing': '料金', 'nav.community': 'コミュニティ',
            'nav.product.overview.t': '概要', 'nav.product.overview.s': '今すぐSheldonを入手',
            'nav.docs.luavm.t': 'Lua VM ドキュメント', 'nav.docs.luavm.s': 'ガイドとリファレンス',
            'nav.product.terms.t': '利用規約', 'nav.product.terms.s': '使用許諾',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Windows 版をダウンロード',
            'nav.download.dash.t': 'ダッシュボード', 'nav.download.dash.s': 'キーとアカウント',
            'nav.product.status.t': 'ステータス', 'nav.product.status.s': 'サービス状況',
            'nav.pricing.plans.t': 'プラン', 'nav.pricing.plans.s': 'ライセンスを比較',
            'nav.pricing.resellers.t': 'リセラー', 'nav.pricing.resellers.s': '認証済み販売者',
            'nav.community.discord.t': 'Discord サーバー', 'nav.community.discord.s': 'チャットとサポート',
            'nav.community.guides.t': 'ガイド', 'nav.community.guides.s': 'ステップバイステップ解説',
            'hero.subtitle': 'Project Sheldon を今すぐ入手 – 最高かつ唯一の Freemium External。',
            'hero.download': 'Windows 版をダウンロード', 'hero.pricing': '料金を見る',
            'hero.terms.pre': 'Sheldonの利用により',
            'hero.terms.link': '利用規約', 'hero.terms.post': 'に同意したものとみなされます',
            'lang.language': '言語',
            'guides.title': 'ガイド',
            'guides.subtitle': 'Project Sheldon のステップバイステップチュートリアル。',
            'guides.search': 'ガイドを検索…',
            'guides.all': 'すべて',
            'guides.back': 'すべてのガイド',
            'guides.empty.t': 'ガイドが見つかりません',
            'guides.empty.s': '別のキーワードやカテゴリーでお試しください。',
            'guides.error.t': 'ガイドを読み込めませんでした',
            'guides.error.s': '現在サーバーに接続できません。',
            'guides.retry': '再試行',
        },
        ko: {
            'lang.title': '언어 선택', 'lang.search': '언어 검색',
            'nav.product': '제품', 'nav.docs': '문서', 'nav.download': '다운로드',
            'nav.pricing': '요금', 'nav.community': '커뮤니티',
            'nav.product.overview.t': '개요', 'nav.product.overview.s': '지금 Sheldon 받기',
            'nav.docs.luavm.t': 'Lua VM 문서', 'nav.docs.luavm.s': '가이드 및 레퍼런스',
            'nav.product.terms.t': '이용약관', 'nav.product.terms.s': '사용 계약',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Windows용 다운로드',
            'nav.download.dash.t': '대시보드', 'nav.download.dash.s': '키와 계정',
            'nav.product.status.t': '상태', 'nav.product.status.s': '서비스 상태',
            'nav.pricing.plans.t': '플랜', 'nav.pricing.plans.s': '라이선스 비교',
            'nav.pricing.resellers.t': '리셀러', 'nav.pricing.resellers.s': '인증된 판매자',
            'nav.community.discord.t': 'Discord 서버', 'nav.community.discord.s': '채팅 및 지원',
            'nav.community.guides.t': '가이드', 'nav.community.guides.s': '단계별 튜토리얼',
            'hero.subtitle': '지금 Project Sheldon을 받아보세요 - 최고이자 유일한 Freemium External.',
            'hero.download': 'Windows용 다운로드', 'hero.pricing': '요금 보기',
            'hero.terms.pre': 'Sheldon을 사용하면',
            'hero.terms.link': '이용약관', 'hero.terms.post': '에 동의하는 것으로 간주됩니다',
            'lang.language': '언어',
            'guides.title': '가이드',
            'guides.subtitle': 'Project Sheldon 단계별 튜토리얼.',
            'guides.search': '가이드 검색…',
            'guides.all': '전체',
            'guides.back': '모든 가이드',
            'guides.empty.t': '가이드를 찾을 수 없습니다',
            'guides.empty.s': '다른 검색어나 카테고리를 사용해 보세요.',
            'guides.error.t': '가이드를 불러오지 못했습니다',
            'guides.error.s': '현재 서버에 연결할 수 없습니다.',
            'guides.retry': '다시 시도',
        },
        it: {
            'lang.title': 'Seleziona la lingua', 'lang.search': 'Cerca lingua',
            'nav.product': 'Prodotto', 'nav.docs': 'Documentazione', 'nav.download': 'Download',
            'nav.pricing': 'Prezzi', 'nav.community': 'Comunità',
            'nav.product.overview.t': 'Panoramica', 'nav.product.overview.s': 'Ottieni Sheldon oggi',
            'nav.docs.luavm.t': 'Docs Lua VM', 'nav.docs.luavm.s': 'Guide e riferimenti',
            'nav.product.terms.t': 'Termini di servizio', 'nav.product.terms.s': 'Accordo di utilizzo',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Scarica per Windows',
            'nav.download.dash.t': 'Dashboard', 'nav.download.dash.s': 'Chiavi e account',
            'nav.product.status.t': 'Stato', 'nav.product.status.s': 'Stato del servizio',
            'nav.pricing.plans.t': 'Piani', 'nav.pricing.plans.s': 'Confronta le licenze',
            'nav.pricing.resellers.t': 'Rivenditori', 'nav.pricing.resellers.s': 'Venditori verificati',
            'nav.community.discord.t': 'Server Discord', 'nav.community.discord.s': 'Chat e supporto',
            'nav.community.guides.t': 'Guide', 'nav.community.guides.s': 'Tutorial passo passo',
            'hero.subtitle': 'Ottieni Project Sheldon oggi – il migliore e unico freemium External.',
            'hero.download': 'Scarica per Windows', 'hero.pricing': 'Vedi i prezzi',
            'hero.terms.pre': 'Usando Sheldon accetti i',
            'hero.terms.link': 'Termini di servizio', 'hero.terms.post': '',
            'lang.language': 'Lingua',
            'guides.title': 'Guide',
            'guides.subtitle': 'Tutorial passo passo per Project Sheldon.',
            'guides.search': 'Cerca guide…',
            'guides.all': 'Tutte',
            'guides.back': 'Tutte le guide',
            'guides.empty.t': 'Nessuna guida trovata',
            'guides.empty.s': 'Prova un\'altra ricerca o categoria.',
            'guides.error.t': 'Impossibile caricare le guide',
            'guides.error.s': 'I server non sono raggiungibili in questo momento.',
            'guides.retry': 'Riprova',
        },
        pl: {
            'lang.title': 'Wybierz język', 'lang.search': 'Szukaj języka',
            'nav.product': 'Produkt', 'nav.docs': 'Dokumentacja', 'nav.download': 'Pobierz',
            'nav.pricing': 'Cennik', 'nav.community': 'Społeczność',
            'nav.product.overview.t': 'Przegląd', 'nav.product.overview.s': 'Zdobądź Sheldon już dziś',
            'nav.docs.luavm.t': 'Docs Lua VM', 'nav.docs.luavm.s': 'Poradniki i referencja',
            'nav.product.terms.t': 'Warunki usługi', 'nav.product.terms.s': 'Umowa użytkowania',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'Pobierz na Windows',
            'nav.download.dash.t': 'Panel', 'nav.download.dash.s': 'Klucze i konto',
            'nav.product.status.t': 'Status', 'nav.product.status.s': 'Stan usługi',
            'nav.pricing.plans.t': 'Plany', 'nav.pricing.plans.s': 'Porównaj licencje',
            'nav.pricing.resellers.t': 'Sprzedawcy', 'nav.pricing.resellers.s': 'Zweryfikowani sprzedawcy',
            'nav.community.discord.t': 'Serwer Discord', 'nav.community.discord.s': 'Czat i wsparcie',
            'nav.community.guides.t': 'Poradniki', 'nav.community.guides.s': 'Instrukcje krok po kroku',
            'hero.subtitle': 'Zdobądź Project Sheldon już dziś – najlepszy i jedyny freemium External.',
            'hero.download': 'Pobierz na Windows', 'hero.pricing': 'Zobacz ceny',
            'hero.terms.pre': 'Korzystając z Sheldon akceptujesz',
            'hero.terms.link': 'Warunki usługi', 'hero.terms.post': '',
            'lang.language': 'Język',
            'guides.title': 'Przewodniki',
            'guides.subtitle': 'Samouczki krok po kroku dla Project Sheldon.',
            'guides.search': 'Szukaj przewodników…',
            'guides.all': 'Wszystkie',
            'guides.back': 'Wszystkie przewodniki',
            'guides.empty.t': 'Nie znaleziono przewodników',
            'guides.empty.s': 'Spróbuj innego wyszukiwania lub kategorii.',
            'guides.error.t': 'Nie udało się wczytać przewodników',
            'guides.error.s': 'Serwery są teraz niedostępne.',
            'guides.retry': 'Spróbuj ponownie',
        },
        ar: {
            'lang.title': 'اختر اللغة', 'lang.search': 'ابحث عن لغة',
            'nav.product': 'المنتج', 'nav.docs': 'التوثيق', 'nav.download': 'تحميل',
            'nav.pricing': 'الأسعار', 'nav.community': 'المجتمع',
            'nav.product.overview.t': 'نظرة عامة', 'nav.product.overview.s': 'احصل على Sheldon اليوم',
            'nav.docs.luavm.t': 'وثائق Lua VM', 'nav.docs.luavm.s': 'أدلة ومرجع',
            'nav.product.terms.t': 'شروط الخدمة', 'nav.product.terms.s': 'اتفاقية الاستخدام',
            'nav.download.win.t': 'Windows', 'nav.download.win.s': 'تحميل لنظام Windows',
            'nav.download.dash.t': 'لوحة التحكم', 'nav.download.dash.s': 'المفاتيح والحساب',
            'nav.product.status.t': 'الحالة', 'nav.product.status.s': 'حالة الخدمة',
            'nav.pricing.plans.t': 'الخطط', 'nav.pricing.plans.s': 'قارن التراخيص',
            'nav.pricing.resellers.t': 'الموزعون', 'nav.pricing.resellers.s': 'بائعون موثوقون',
            'nav.community.discord.t': 'سيرفر Discord', 'nav.community.discord.s': 'دردشة ودعم',
            'nav.community.guides.t': 'الأدلة', 'nav.community.guides.s': 'شروحات خطوة بخطوة',
            'hero.subtitle': 'احصل على Project Sheldon اليوم - الأفضل والوحيد Freemium External.',
            'hero.download': 'تحميل لنظام Windows', 'hero.pricing': 'عرض الأسعار',
            'hero.terms.pre': 'باستخدام Sheldon فأنت توافق على',
            'hero.terms.link': 'شروط الخدمة', 'hero.terms.post': '',
            'lang.language': 'اللغة',
            'guides.title': 'الأدلة',
            'guides.subtitle': 'شروحات خطوة بخطوة لمشروع شيلدون.',
            'guides.search': 'ابحث في الأدلة…',
            'guides.all': 'الكل',
            'guides.back': 'كل الأدلة',
            'guides.empty.t': 'لم يتم العثور على أدلة',
            'guides.empty.s': 'جرّب بحثًا أو فئة أخرى.',
            'guides.error.t': 'تعذر تحميل الأدلة',
            'guides.error.s': 'الخوادم غير متاحة في الوقت الحالي.',
            'guides.retry': 'إعادة المحاولة',
        },
    };

    function pick(code)
    {
        return LANGS.find(l => l.code === code) || LANGS[0];
    }

    function get()
    {
        // Cookie first (shared across every path), then localStorage, then default.
        try {
            const c = getCookie(STORE_KEY);
            if (c && LANGS.some(l => l.code === c)) return c;
        } catch (e) {}
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (raw && LANGS.some(l => l.code === raw)) return raw;
        } catch (e) {}
        return 'en';
    }

    function t(key, code)
    {
        const lang = code || get();
        if (STRINGS[lang] && STRINGS[lang][key] !== undefined) return STRINGS[lang][key];
        return STRINGS.en[key] !== undefined ? STRINGS.en[key] : key;
    }

    function applyStrings(code)
    {
        const lang = code || get();
        try { document.documentElement.lang = lang; } catch (e) {}
        try { document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'; } catch (e) {}
        document.querySelectorAll('[data-i18n]').forEach(el =>
        {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key, lang);
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el =>
        {
            const key = el.getAttribute('data-i18n-ph');
            if (key) el.setAttribute('placeholder', t(key, lang));
        });
        updateTriggers(lang);
    }

    function updateTriggers(code)
    {
        const cur = pick(code || get());
        document.querySelectorAll('[data-lang-current]').forEach(el =>
        {
            el.textContent = cur.native;
        });
    }

    function set(code)
    {
        if (!LANGS.some(l => l.code === code)) return;
        try { setCookie(STORE_KEY, code); } catch (e) {}
        try { localStorage.setItem(STORE_KEY, code); } catch (e) {}
        applyStrings(code);
        // Let pages with JS-rendered text (guides chips, dates) rebuild themselves.
        try { window.dispatchEvent(new CustomEvent('sheldon:lang', { detail: code })); } catch (e) {}
    }

    function ensureStyles()
    {
        if (document.getElementById('sheldon-lang-styles')) return;
        const css =
            '.sl-pop{position:fixed;z-index:10002;width:300px;max-width:calc(100vw - 32px);background:rgba(17,17,17,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:8px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 40px rgba(199,177,143,.07);opacity:0;transform:translateY(-4px);transition:opacity .15s ease,transform .15s ease}' +
            '.sl-pop.open{opacity:1;transform:none}' +
            '.sl-search{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 18px;margin:4px;font-size:14px;color:#fff;width:calc(100% - 8px);outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .2s,box-shadow .2s}' +
            '.sl-search:focus{border-color:rgba(199,177,143,.45);box-shadow:0 0 0 3px rgba(199,177,143,.12)}' +
            '.sl-search::placeholder{color:#525252}' +
            '.sl-list{margin-top:4px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:300px;padding-right:0;margin-right:-3px;overscroll-behavior:contain}' +
            '.sl-list::-webkit-scrollbar{width:6px}' +
            '.sl-list::-webkit-scrollbar-thumb{background:rgba(199,177,143,.25);border-radius:99px}' +
            '.sl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;background:none;border:none;padding:10px 14px;border-radius:12px;cursor:pointer;font-family:inherit;transition:background .15s}' +
            '.sl-row:hover{background:rgba(255,255,255,.05)}' +
            '.sl-row.sel{background:rgba(199,177,143,.1)}' +
            '.sl-native{display:block;font-size:14px;font-weight:700;color:#fff}' +
            '.sl-row.sel .sl-native{color:#c7b18f}' +
            '.sl-en{display:block;font-size:12px;color:#737373;margin-top:1px}' +
            '.sl-check{width:24px;height:24px;border-radius:8px;background:#c7b18f;color:#000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;box-shadow:0 0 12px rgba(199,177,143,.35)}' +
            '.sl-empty{padding:20px;text-align:center;font-size:13px;color:#737373}';
        const el = document.createElement('style');
        el.id = 'sheldon-lang-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    // Cookie persistence (path=/ so every page shares it) alongside localStorage.
    function getCookie(name)
    {
        const parts = ('; ' + (document.cookie || '')).split('; ' + name + '=');
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
        return null;
    }

    function setCookie(name, value)
    {
        document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
    }

    // Accent-insensitive compare so "turkce" finds "Türkçe",
    // "espanol" finds "Español", etc.
    function norm(s)
    {
        return (s || '').toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
            .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd');
    }

    let pop = null;
    let popAnchor = null;

    function rowMarkup(lang, selected)
    {
        return '<button class="sl-row' + (selected ? ' sel' : '') + '" data-lang-pick="' + lang.code + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '">' +
            '<span><span class="sl-native">' + lang.native + '</span>' +
            '<span class="sl-en">' + lang.english + '</span></span>' +
            (selected ? '<span class="sl-check">✓</span>' : '') +
        '</button>';
    }

    function place(anchor, rect)
    {
        if (!pop) return;
        const r = rect || anchor.getBoundingClientRect();
        const w = Math.min(300, window.innerWidth - 32);
        let left = r.right - w;
        left = Math.max(16, Math.min(left, window.innerWidth - w - 16));
        let top = r.bottom + 8;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        const h = pop.offsetHeight;
        if (top + h > window.innerHeight - 12)
            pop.style.top = Math.max(12, r.top - h - 8) + 'px';
    }

    function close()
    {
        if (!pop) return;
        const el = pop;
        pop = null;
        popAnchor = null;
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('mousedown', onOutside, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', onScroll, true);
        el.classList.remove('open');
        setTimeout(() => el.remove(), 150);
    }

    function onKey(e)
    {
        if (e.key === 'Escape') close();
    }

    function onOutside(e)
    {
        if (!pop) return;
        if (pop.contains(e.target)) return;
        if (popAnchor && popAnchor.contains(e.target)) return;
        close();
    }

    function onScroll(e)
    {
        // Keep the dropdown alive while scrolling inside it; otherwise dismiss.
        if (pop && !pop.contains(e.target)) close();
    }

    // Toggle the anchored dropdown. `rect` may be passed when the anchor is
    // about to be hidden (mobile menu closes before the panel opens).
    function open(anchor, rect)
    {
        if (popAnchor === anchor && pop) { close(); return; }
        close();
        ensureStyles();

        popAnchor = anchor;
        pop = document.createElement('div');
        pop.className = 'sl-pop';
        pop.setAttribute('role', 'listbox');
        pop.setAttribute('aria-label', t('lang.title'));

        const search = document.createElement('input');
        search.className = 'sl-search';
        search.type = 'text';
        search.setAttribute('placeholder', t('lang.search'));
        search.setAttribute('aria-label', t('lang.search'));
        search.setAttribute('autocomplete', 'off');

        const list = document.createElement('div');
        list.className = 'sl-list';

        function render(filter)
        {
            const q = norm((filter || '').trim());
            list.innerHTML = '';
            const current = get();
            const matches = LANGS.filter(l =>
                !q || norm(l.native).includes(q) || norm(l.english).includes(q));
            if (!matches.length)
            {
                const empty = document.createElement('div');
                empty.className = 'sl-empty';
                empty.textContent = '–';
                list.append(empty);
                return;
            }
            matches.forEach(l =>
            {
                const wrap = document.createElement('div');
                wrap.innerHTML = rowMarkup(l, l.code === current);
                const btn = wrap.firstChild;
                btn.addEventListener('click', () =>
                {
                    set(l.code);
                    close();
                });
                list.append(btn);
            });
        }

        search.addEventListener('input', () => { render(search.value); place(anchor); });
        pop.append(search, list);
        document.body.append(pop);
        render('');
        place(anchor, rect);

        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onOutside, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', onScroll, true);

        requestAnimationFrame(() => requestAnimationFrame(() => { if (pop) pop.classList.add('open'); }));
        setTimeout(() => { try { search.focus({ preventScroll: true }); } catch (e) { try { search.focus(); } catch (_) {} } }, 60);
    }

    let wired = false;
    function init()
    {
        ensureStyles();
        applyStrings(get());
        if (wired) return;
        wired = true;
        // Delegated so buttons injected later (shared topbar) work too.
        document.addEventListener('click', e =>
        {
            const btn = e.target && e.target.closest ? e.target.closest('[data-lang-btn]') : null;
            if (!btn) return;
            e.preventDefault();
            // Capture position first – the mobile menu (if open) closes and
            // would otherwise invalidate the anchor rect.
            const rect = btn.getBoundingClientRect();
            const menu = document.getElementById('mobileMenu');
            if (menu) menu.classList.remove('show');
            open(btn, rect);
        });
    }

    window.SheldonLang = { LANGS, STRINGS, get, set, t, open, init, applyStrings };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

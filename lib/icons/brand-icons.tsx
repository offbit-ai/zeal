import React from 'react'
// Brand icons from react-icons
import {
  // Social Media
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaTiktok,
  FaSnapchat,
  FaPinterest,
  FaReddit,
  FaDiscord,
  FaTelegram,
  FaWhatsapp,
  // Tech Companies
  FaGoogle,
  FaMicrosoft,
  FaApple,
  FaAmazon,
  FaGithub,
  FaGitlab,
  FaSlack,
  FaDropbox,
  FaTrello,
  // Development
  FaReact,
  FaVuejs,
  FaAngular,
  FaNodeJs,
  FaPython,
  FaJava,
  FaJs,
  FaHtml5,
  FaCss3,
  FaDocker,
  FaAws,
  FaDigitalOcean,
  // Others
  FaStripe,
  FaPaypal,
  FaSpotify,
  FaUber,
  FaAirbnb,
  FaSalesforce,
  FaShopify,
  FaWordpress,
  FaMailchimp,
  FaFileExcel,
} from 'react-icons/fa'

import {
  // Additional brand icons from other react-icons sets
  SiOpenai,
  SiClaude,
  SiMongodb,
  SiPostgresql,
  SiMysql,
  SiRedis,
  SiElasticsearch,
  SiRabbitmq,
  SiGraphql,
  SiTensorflow,
  SiPytorch,
  SiKeras,
  SiScipy,
  SiNumpy,
  SiPandas,
  SiJupyter,
  SiTableau,
  SiLooker,
  SiDbt,
  SiAsana,
  SiZoom,
  SiHubspot,
  SiSnowflake,
  SiDatabricks,
  SiApacheairflow,
  SiAmazons3,
  SiKubernetes,
  SiTerraform,
  SiJenkins,
  SiGithubactions,
  SiCircleci,
  SiTravisci,
  SiPrometheus,
  SiGrafana,
  SiDatadog,
  SiNewrelic,
  SiSentry,
  SiVercel,
  SiNetlify,
  SiHeroku,
  SiFigma,
  SiSketch,
  SiAdobe,
  SiCanva,
  SiMiro,
  SiNotion,
  SiAirtable,
  SiClickup,
  SiZapier,
  SiMake,
  SiN8N,
  SiRetool,
  SiPostman,
  SiInsomnia,
  SiGooglesheets,
  SiDocker,
  SiApachekafka,
  SiHuggingface,
  SiAmazonwebservices,
  SiGooglegemini,
  SiLangchain,
  SiJavascript,
  SiPython,
  SiNushell,
} from 'react-icons/si'

/**
 * Brand icon component props
 */
export interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
  color?: string
}

/**
 * Brand Icons Registry
 * Organized by category for easy discovery
 */
export const BrandIcons = {
  // Social Media Platforms
  social: {
    facebook: FaFacebook,
    twitter: FaTwitter,
    instagram: FaInstagram,
    linkedin: FaLinkedin,
    youtube: FaYoutube,
    tiktok: FaTiktok,
    snapchat: FaSnapchat,
    pinterest: FaPinterest,
    reddit: FaReddit,
    discord: FaDiscord,
    telegram: FaTelegram,
    whatsapp: FaWhatsapp,
  },

  // Tech Companies
  tech: {
    google: FaGoogle,
    microsoft: FaMicrosoft,
    apple: FaApple,
    amazon: FaAmazon,
    github: FaGithub,
    gitlab: FaGitlab,
    slack: FaSlack,
    zoom: SiZoom,
    dropbox: FaDropbox,
    trello: FaTrello,
    asana: SiAsana,
    notion: SiNotion,
  },

  // AI & ML Companies
  ai: {
    openai: SiOpenai,
    anthropic: SiClaude,
    gemini: SiGooglegemini,
    langchain: SiLangchain,
    tensorflow: SiTensorflow,
    pytorch: SiPytorch,
    keras: SiKeras,
    jupyter: SiJupyter,
    huggingface: SiHuggingface,
  },

  // Databases
  database: {
    mongodb: SiMongodb,
    postgresql: SiPostgresql,
    mysql: SiMysql,
    redis: SiRedis,
    elasticsearch: SiElasticsearch,
    snowflake: SiSnowflake,
  },

  // Development Tools & Frameworks
  dev: {
    react: FaReact,
    vue: FaVuejs,
    angular: FaAngular,
    nodejs: FaNodeJs,
    python: SiPython,
    nushell: SiNushell,
    java: FaJava,
    javascript: SiJavascript,
    html5: FaHtml5,
    css3: FaCss3,
    docker: SiDocker,
    kubernetes: SiKubernetes,
    graphql: SiGraphql,
    // 'grpc': SiGrpc,
  },

  // Cloud & Infrastructure
  cloud: {
    aws: SiAmazonwebservices,
    digitalocean: FaDigitalOcean,
    vercel: SiVercel,
    netlify: SiNetlify,
    heroku: SiHeroku,
    terraform: SiTerraform,
  },

  // Data & Analytics
  data: {
    databricks: SiDatabricks,
    airflow: SiApacheairflow,
    tableau: SiTableau,
    // 'powerbi': SiPowerbi,
    looker: SiLooker,
    dbt: SiDbt,
    pandas: SiPandas,
    numpy: SiNumpy,
    scipy: SiScipy,
  },

  // DevOps & Monitoring
  devops: {
    jenkins: SiJenkins,
    'github-actions': SiGithubactions,
    circleci: SiCircleci,
    travisci: SiTravisci,
    prometheus: SiPrometheus,
    grafana: SiGrafana,
    datadog: SiDatadog,
    newrelic: SiNewrelic,
    sentry: SiSentry,
  },

  // Messaging & Communication
  messaging: {
    kafka: SiApachekafka,
    rabbitmq: SiRabbitmq,
    zapier: SiZapier,
    make: SiMake,
    n8n: SiN8N,
  },

  // Design & Productivity
  design: {
    figma: SiFigma,
    sketch: SiSketch,
    adobe: SiAdobe,
    canva: SiCanva,
    miro: SiMiro,
    clickup: SiClickup,
  },

  // Productivity & Office
  productivity: {
    'google-sheets': SiGooglesheets,
    excel: FaFileExcel,
    airtable: SiAirtable,
  },

  // API & Development Tools
  api: {
    postman: SiPostman,
    insomnia: SiInsomnia,
    retool: SiRetool,
  },

  // Payment & Business
  business: {
    stripe: FaStripe,
    paypal: FaPaypal,
    salesforce: FaSalesforce,
    shopify: FaShopify,
    mailchimp: FaMailchimp,
    hubspot: SiHubspot,
  },

  // Entertainment & Media
  media: {
    spotify: FaSpotify,
    wordpress: FaWordpress,
  },

  // Transportation & Services
  services: {
    uber: FaUber,
    airbnb: FaAirbnb,
  },
}

/**
 * Flat registry for easy lookup
 */
export const FlatBrandIconRegistry: Record<string, React.ComponentType<BrandIconProps>> = {}

// Build flat registry from categorized icons
Object.values(BrandIcons).forEach(category => {
  Object.entries(category).forEach(([name, component]) => {
    FlatBrandIconRegistry[name] = component

    // Add variations
    FlatBrandIconRegistry[name.toLowerCase()] = component
    FlatBrandIconRegistry[name.toUpperCase()] = component

    // Add with underscores
    const underscoreName = name.replace(/-/g, '_')
    FlatBrandIconRegistry[underscoreName] = component

    // Add with 'brand-' prefix
    FlatBrandIconRegistry[`brand-${name}`] = component
  })
})

/**
 * Get a brand icon by name
 */
export function getBrandIcon(name: string): React.ComponentType<BrandIconProps> | null {
  if (!name || typeof name !== 'string') return null

  // Try exact match
  if (FlatBrandIconRegistry[name]) {
    return FlatBrandIconRegistry[name]
  }

  // Try lowercase
  const lowerName = name.toLowerCase()
  if (FlatBrandIconRegistry[lowerName]) {
    return FlatBrandIconRegistry[lowerName]
  }

  // Try without brand prefix
  const withoutBrand = lowerName.replace(/^brand[-_]?/, '')
  if (FlatBrandIconRegistry[withoutBrand]) {
    return FlatBrandIconRegistry[withoutBrand]
  }

  return null
}

/**
 * Get all available brand icon names
 */
export function getBrandIconNames(): string[] {
  return Object.keys(FlatBrandIconRegistry).sort()
}

/**
 * Get brand icons by category
 */
export function getBrandIconsByCategory(
  category: keyof typeof BrandIcons
): Record<string, React.ComponentType<BrandIconProps>> {
  return BrandIcons[category] || {}
}

/**
 * Search brand icons by name or category
 */
export function searchBrandIcons(query: string): string[] {
  const lowerQuery = query.toLowerCase()
  return Object.keys(FlatBrandIconRegistry)
    .filter(name => name.toLowerCase().includes(lowerQuery))
    .slice(0, 50) // Limit results
    .sort()
}

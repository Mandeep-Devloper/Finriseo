import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://finriseo.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://finriseo.com/personal-loan', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://finriseo.com/business-loan', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://finriseo.com/education-loan', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://finriseo.com/pocket-loan', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://finriseo.com/home-loan', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://finriseo.com/medical-loan', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://finriseo.com/emi-calculator', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://finriseo.com/about', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://finriseo.com/contact', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://finriseo.com/grievance', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://finriseo.com/privacy-policy', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://finriseo.com/terms', changeFrequency: 'monthly', priority: 0.5 },
  ];
}

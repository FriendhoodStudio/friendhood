export interface ServiceItem {
  name: string;
  cardTitle: string;
  imageUrl: string;
  overview: string;
  modules: string[];
}

export interface ServicesData {
  descriptor: string;
  paragraph: string;
  services: ServiceItem[];
}

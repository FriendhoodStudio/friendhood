export interface ApproachCard {
  title: string;
  text: string;
  imageUrl: string;
}

export interface AboutData {
  introLabel: string;
  introLabelMuted: string;
  introHeading: string;
  introImageUrl: string;
  introImageWideUrl: string;
  servicesLabel: string;
  servicesHeading: string;
  approachLabel: string;
  approachHeading: string;
  approachCards: ApproachCard[];
  clientsLabel: string;
  clients: string[];
}

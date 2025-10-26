import { registerEnumType } from '@nestjs/graphql';

export enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',

}

registerEnumType(SubscriptionPlan, {
  name: 'SubscriptionPlan',
  description: 'Planes de suscripción para companies',
});

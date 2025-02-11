import {
  PrismaClient,
  PrismaPromise,
  Delta as PrismaDelta,
  Player as PrismaPlayer,
  Record as PrismaRecord,
  Snapshot as PrismaSnapshot,
  Achievement as PrismaAchievement,
  Patron,
  Competition,
  Participation,
  NameChange as PrismaNameChange,
  Group,
  Membership,
  Prisma,
  Country,
  MemberActivity
} from '@prisma/client';
import { DenyContext, SkipContext, isComputedMetric } from '../utils';
import { NameChangeStatus } from './enum-adapter';
import { routeAfterHook } from './hooks';
import { parseBigInt } from './utils';

let hooksEnabled = true;

const prisma = new PrismaClient();

const extendedClient = prisma.$extends({
  result: {
    record: {
      value: {
        needs: { metric: true, value: true },
        compute({ value, metric }) {
          return isComputedMetric(metric) ? parseBigInt(value) / 10_000 : parseBigInt(value);
        }
      }
    },
    achievement: {
      threshold: {
        needs: { threshold: true },
        compute({ threshold }) {
          return parseBigInt(threshold);
        }
      },
      accuracy: {
        needs: { accuracy: true },
        compute({ accuracy }) {
          return accuracy == null ? null : parseBigInt(accuracy);
        }
      }
    },
    snapshot: {
      overallExperience: {
        needs: { overallExperience: true },
        compute({ overallExperience }) {
          return parseBigInt(overallExperience);
        }
      }
    },
    delta: {
      overall: {
        needs: { overall: true },
        compute({ overall }) {
          return parseBigInt(overall);
        }
      }
    },
    player: {
      exp: {
        needs: { exp: true },
        compute({ exp }) {
          return parseBigInt(exp);
        }
      },
      latestSnapshotId: {
        meeds: {},
        compute() {
          return undefined;
        }
      }
    }
  }
});

// Register Hooks
prisma.$use(async (params, next) => {
  const result = await next(params);

  // These hooks are executed after the database operation has executed
  if (hooksEnabled) routeAfterHook(params, result);

  return result;
});

function setHooksEnabled(enabled: boolean) {
  hooksEnabled = enabled;
}

type Achievement = Omit<PrismaAchievement, 'threshold' | 'accuracy'> & {
  threshold: number;
  accuracy: number | null;
};

type Record = Omit<PrismaRecord, 'value'> & {
  value: number;
};

type Delta = Omit<PrismaDelta, 'overall'> & {
  overall: number;
};

type Snapshot = Omit<PrismaSnapshot, 'overallExperience'> & {
  overallExperience: number;
};

type Player = Omit<PrismaPlayer, 'exp' | 'latestSnapshotId'> & {
  exp: number;
};

type NameChange = Omit<PrismaNameChange, 'reviewContext'> & {
  reviewContext: SkipContext | DenyContext | null;
};

export {
  Prisma as PrismaTypes,
  PrismaPromise,
  // Models
  NameChange,
  Patron,
  Group,
  Membership,
  Competition,
  Participation,
  Player,
  Delta,
  Record,
  Snapshot,
  Achievement,
  MemberActivity,
  // Enums
  Country,
  NameChangeStatus,
  // Utils
  setHooksEnabled
};

export default extendedClient;

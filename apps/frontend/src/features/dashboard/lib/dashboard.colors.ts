export interface MetricProgressTone {
  iconClassName: string;
  barClassName: string;
}

export interface StorageTone {
  dotClassName: string;
  textClassName: string;
  iconClassName: string;
  cardClassName: string;
}

const dangerTone = 'bg-red-500';

export function getCpuProgressTone(usage: number): MetricProgressTone {
  if (usage > 80) {
    return {
      iconClassName: 'text-red-400',
      barClassName: dangerTone,
    };
  }

  if (usage > 50) {
    return {
      iconClassName: 'text-fuchsia-400',
      barClassName: 'bg-fuchsia-500',
    };
  }

  return {
    iconClassName: 'text-violet-400',
    barClassName: 'bg-violet-500',
  };
}

export function getMemoryProgressTone(usage: number): MetricProgressTone {
  if (usage > 80) {
    return {
      iconClassName: 'text-red-400',
      barClassName: dangerTone,
    };
  }

  if (usage > 60) {
    return {
      iconClassName: 'text-cyan-300',
      barClassName: 'bg-cyan-400',
    };
  }

  return {
    iconClassName: 'text-sky-400',
    barClassName: 'bg-sky-500',
  };
}

export function getDiskProgressTone(usage: number): MetricProgressTone {
  if (usage > 90) {
    return {
      iconClassName: 'text-red-400',
      barClassName: dangerTone,
    };
  }

  if (usage > 75) {
    return {
      iconClassName: 'text-orange-300',
      barClassName: 'bg-orange-400',
    };
  }

  return {
    iconClassName: 'text-emerald-400',
    barClassName: 'bg-emerald-500',
  };
}

export const dashboardStorageTones = {
  storageDocker: {
    dotClassName: 'bg-sky-400',
    textClassName: 'text-sky-300',
    iconClassName: 'text-sky-400',
    cardClassName: 'border-sky-500/20 bg-sky-500/[0.06]',
  },
  engineDocker: {
    dotClassName: 'bg-indigo-400',
    textClassName: 'text-indigo-300',
    iconClassName: 'text-indigo-400',
    cardClassName: 'border-indigo-500/20 bg-indigo-500/[0.06]',
  },
  reclaimable: {
    dotClassName: 'bg-emerald-400',
    textClassName: 'text-emerald-300',
    iconClassName: 'text-emerald-400',
    cardClassName: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  },
  applications: {
    dotClassName: 'bg-violet-400',
    textClassName: 'text-violet-300',
    iconClassName: 'text-violet-400',
    cardClassName: 'border-violet-500/20 bg-violet-500/[0.06]',
  },
  other: {
    dotClassName: 'bg-slate-400',
    textClassName: 'text-slate-300',
    iconClassName: 'text-slate-400',
    cardClassName: 'border-slate-500/20 bg-slate-500/[0.08]',
  },
  images: {
    dotClassName: 'bg-sky-400',
    textClassName: 'text-sky-300',
    iconClassName: 'text-sky-400',
    cardClassName: 'border-sky-500/20 bg-sky-500/[0.05]',
  },
  containers: {
    dotClassName: 'bg-emerald-400',
    textClassName: 'text-emerald-300',
    iconClassName: 'text-emerald-400',
    cardClassName: 'border-emerald-500/20 bg-emerald-500/[0.05]',
  },
  volumes: {
    dotClassName: 'bg-violet-400',
    textClassName: 'text-violet-300',
    iconClassName: 'text-violet-400',
    cardClassName: 'border-violet-500/20 bg-violet-500/[0.05]',
  },
  buildCache: {
    dotClassName: 'bg-cyan-400',
    textClassName: 'text-cyan-300',
    iconClassName: 'text-cyan-400',
    cardClassName: 'border-cyan-500/20 bg-cyan-500/[0.05]',
  },
} satisfies Record<string, StorageTone>;

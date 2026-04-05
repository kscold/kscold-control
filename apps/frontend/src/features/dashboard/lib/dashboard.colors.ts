export interface MetricProgressTone {
  iconClassName: string;
  barClassName: string;
}

export interface StorageTone {
  dotClassName: string;
  textClassName: string;
  iconClassName: string;
  cardClassName: string;
  barClassName: string;
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
    dotClassName: 'bg-cyan-400',
    textClassName: 'text-cyan-300',
    iconClassName: 'text-cyan-400',
    cardClassName: 'border-cyan-500/20 bg-cyan-500/[0.06]',
    barClassName: 'bg-cyan-500',
  },
  engineDocker: {
    dotClassName: 'bg-blue-400',
    textClassName: 'text-blue-300',
    iconClassName: 'text-blue-400',
    cardClassName: 'border-blue-500/20 bg-blue-500/[0.06]',
    barClassName: 'bg-blue-500',
  },
  reclaimable: {
    dotClassName: 'bg-emerald-400',
    textClassName: 'text-emerald-300',
    iconClassName: 'text-emerald-400',
    cardClassName: 'border-emerald-500/20 bg-emerald-500/[0.06]',
    barClassName: 'bg-emerald-500',
  },
  applications: {
    dotClassName: 'bg-rose-400',
    textClassName: 'text-rose-300',
    iconClassName: 'text-rose-400',
    cardClassName: 'border-rose-500/20 bg-rose-500/[0.06]',
    barClassName: 'bg-rose-500',
  },
  other: {
    dotClassName: 'bg-orange-300',
    textClassName: 'text-orange-200',
    iconClassName: 'text-orange-300',
    cardClassName: 'border-orange-500/20 bg-orange-500/[0.08]',
    barClassName: 'bg-orange-400',
  },
  free: {
    dotClassName: 'bg-slate-600',
    textClassName: 'text-slate-400',
    iconClassName: 'text-slate-500',
    cardClassName: 'border-slate-500/20 bg-slate-500/[0.06]',
    barClassName: 'bg-slate-700',
  },
  images: {
    dotClassName: 'bg-sky-400',
    textClassName: 'text-sky-300',
    iconClassName: 'text-sky-400',
    cardClassName: 'border-sky-500/20 bg-sky-500/[0.05]',
    barClassName: 'bg-sky-500',
  },
  containers: {
    dotClassName: 'bg-emerald-400',
    textClassName: 'text-emerald-300',
    iconClassName: 'text-emerald-400',
    cardClassName: 'border-emerald-500/20 bg-emerald-500/[0.05]',
    barClassName: 'bg-emerald-500',
  },
  volumes: {
    dotClassName: 'bg-violet-400',
    textClassName: 'text-violet-300',
    iconClassName: 'text-violet-400',
    cardClassName: 'border-violet-500/20 bg-violet-500/[0.05]',
    barClassName: 'bg-violet-500',
  },
  buildCache: {
    dotClassName: 'bg-cyan-400',
    textClassName: 'text-cyan-300',
    iconClassName: 'text-cyan-400',
    cardClassName: 'border-cyan-500/20 bg-cyan-500/[0.05]',
    barClassName: 'bg-cyan-500',
  },
} satisfies Record<string, StorageTone>;

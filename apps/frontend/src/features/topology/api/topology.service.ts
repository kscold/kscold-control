import { api } from '@/shared/api/client';
import type {
  ContainerData,
  ContainerProcesses,
  NginxSiteData,
  UpnpMappingData,
} from '@/entities/container';

export interface TopologySources {
  containers: ContainerData[];
  sites: NginxSiteData[];
  upnpMappings: UpnpMappingData[];
}

export const topologyService = {
  async getContainerProcesses(
    containerId: string,
  ): Promise<ContainerProcesses> {
    const { data } = await api.get<ContainerProcesses>(
      `/docker/containers/${containerId}/processes`,
    );
    return data;
  },

  async getSources(): Promise<TopologySources> {
    const [containers, sites, upnpMappings] = await Promise.allSettled([
      api.get<ContainerData[]>('/docker/containers/all'),
      api.get<NginxSiteData[]>('/nginx/sites'),
      api.get<UpnpMappingData[]>('/upnp/mappings'),
    ]);

    return {
      containers:
        containers.status === 'fulfilled' ? containers.value.data : [],
      sites: sites.status === 'fulfilled' ? sites.value.data : [],
      upnpMappings:
        upnpMappings.status === 'fulfilled' ? upnpMappings.value.data : [],
    };
  },
};

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { TopologyNodeLayout } from '../../domain/entities/topology-node-layout.entity';
import {
  ITopologyLayoutRepository,
  TopologyNodePosition,
} from '../../domain/repositories/topology-layout.repository.interface';

@Injectable()
export class TypeOrmTopologyLayoutRepository
  implements ITopologyLayoutRepository
{
  private readonly logger = new Logger(TypeOrmTopologyLayoutRepository.name);
  private layoutTableReady = false;
  private layoutTableInitialization: Promise<void> | null = null;

  constructor(
    @InjectRepository(TopologyNodeLayout)
    private readonly repository: Repository<TopologyNodeLayout>,
  ) {}

  async upsertPositions(
    userId: string,
    positions: TopologyNodePosition[],
  ): Promise<void> {
    if (positions.length === 0) return;
    await this.ensureLayoutTable();

    const valuesSql = positions
      .map((_, index) => {
        const offset = index * 5;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      })
      .join(', ');
    const parameters = positions.flatMap((position) => [
      randomUUID(),
      userId,
      position.nodeId,
      position.x,
      position.y,
    ]);

    await this.repository.query(
      `
        INSERT INTO topology_node_layouts (id, user_id, node_id, x, y)
        VALUES ${valuesSql}
        ON CONFLICT (user_id, node_id)
        DO UPDATE SET
          x = EXCLUDED.x,
          y = EXCLUDED.y,
          updated_at = NOW()
      `,
      parameters,
    );
  }

  async findPositionsByUser(userId: string): Promise<TopologyNodePosition[]> {
    await this.ensureLayoutTable();
    const rows: Array<{ nodeId: string; x: number; y: number }> =
      await this.repository.query(
        `
          SELECT node_id AS "nodeId", x, y
          FROM topology_node_layouts
          WHERE user_id = $1
        `,
        [userId],
      );
    return rows.map((row) => ({
      nodeId: row.nodeId,
      x: Number(row.x),
      y: Number(row.y),
    }));
  }

  /** synchronize가 꺼진 프로덕션에서도 테이블을 보증한다 (1회 지연 초기화). */
  private async ensureLayoutTable(): Promise<void> {
    if (this.layoutTableReady) return;

    if (!this.layoutTableInitialization) {
      this.layoutTableInitialization = this.repository
        .query(
          `
            CREATE TABLE IF NOT EXISTS topology_node_layouts (
              id uuid PRIMARY KEY,
              user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              node_id varchar NOT NULL,
              x double precision NOT NULL,
              y double precision NOT NULL,
              created_at timestamptz NOT NULL DEFAULT NOW(),
              updated_at timestamptz NOT NULL DEFAULT NOW(),
              CONSTRAINT topology_node_layouts_user_node_key UNIQUE (user_id, node_id)
            )
          `,
        )
        .then(() => {
          this.layoutTableReady = true;
        })
        .catch((error: Error) => {
          this.layoutTableInitialization = null;
          this.logger.error('topology_node_layouts 테이블 준비 실패', error);
          throw error;
        });
    }

    await this.layoutTableInitialization;
  }
}

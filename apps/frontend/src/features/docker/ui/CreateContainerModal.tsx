import {
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';

interface ContainerConfig {
  name: string;
  image: string;
  cpus: number;
  memory: string;
  sshPort: number;
  httpPort: number;
}

interface CreateContainerModalProps {
  show: boolean;
  config: ContainerConfig;
  isCreating: boolean;
  isPreparing: boolean;
  templateWarning: string | null;
  onClose: () => void;
  onConfigChange: (updates: Partial<ContainerConfig>) => void;
  onCreate: () => void;
}

const FIELD_CLASS = dialogInputClass('blue');

/**
 * compose로 새 Docker 인스턴스를 생성하는 모달
 */
export function CreateContainerModal({
  show,
  config,
  isCreating,
  isPreparing,
  templateWarning,
  onClose,
  onConfigChange,
  onCreate,
}: CreateContainerModalProps) {
  return (
    <Dialog
      open={show}
      title="인스턴스 생성"
      description="docker-compose.yml에 서비스가 추가되고 자동으로 시작됩니다."
      onClose={onClose}
      busy={isCreating}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={isCreating || isPreparing}
            className={dialogButtonClass('blue')}
          >
            {isCreating ? '생성 중...' : '생성'}
          </button>
        </>
      }
    >
      {templateWarning ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {templateWarning}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="create-container-name" className={DIALOG_LABEL_CLASS}>
            인스턴스 이름
          </label>
          <input
            id="create-container-name"
            type="text"
            value={config.name}
            onChange={(e) => onConfigChange({ name: e.target.value })}
            disabled={isPreparing}
            className={FIELD_CLASS}
            placeholder="ubuntu-myproject"
          />
        </div>

        <div>
          <label
            htmlFor="create-container-image"
            className={DIALOG_LABEL_CLASS}
          >
            이미지
          </label>
          <select
            id="create-container-image"
            value={config.image}
            onChange={(e) => onConfigChange({ image: e.target.value })}
            disabled={isPreparing}
            className={FIELD_CLASS}
          >
            <option value="ubuntu:22.04">Ubuntu 22.04 LTS</option>
            <option value="ubuntu:20.04">Ubuntu 20.04 LTS</option>
            <option value="ubuntu:24.04">Ubuntu 24.04 LTS</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label
              htmlFor="create-container-cpus"
              className={DIALOG_LABEL_CLASS}
            >
              CPU (cores)
            </label>
            <input
              id="create-container-cpus"
              type="number"
              min="1"
              max="8"
              value={config.cpus}
              onChange={(e) =>
                onConfigChange({ cpus: parseInt(e.target.value) })
              }
              disabled={isPreparing}
              className={FIELD_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="create-container-memory"
              className={DIALOG_LABEL_CLASS}
            >
              메모리
            </label>
            <select
              id="create-container-memory"
              value={config.memory}
              onChange={(e) => onConfigChange({ memory: e.target.value })}
              disabled={isPreparing}
              className={FIELD_CLASS}
            >
              <option value="1g">1GB</option>
              <option value="2g">2GB</option>
              <option value="4g">4GB</option>
              <option value="8g">8GB</option>
              <option value="16g">16GB</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label
              htmlFor="create-container-ssh-port"
              className={DIALOG_LABEL_CLASS}
            >
              SSH 포트
            </label>
            <input
              id="create-container-ssh-port"
              type="number"
              min="2222"
              max="9999"
              value={config.sshPort}
              onChange={(e) =>
                onConfigChange({ sshPort: parseInt(e.target.value) })
              }
              disabled={isPreparing}
              className={FIELD_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="create-container-http-port"
              className={DIALOG_LABEL_CLASS}
            >
              HTTP 포트
            </label>
            <input
              id="create-container-http-port"
              type="number"
              min="8001"
              max="9999"
              value={config.httpPort}
              onChange={(e) =>
                onConfigChange({ httpPort: parseInt(e.target.value) })
              }
              disabled={isPreparing}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </div>

      {isPreparing ? (
        <div className="mt-4 space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-gray-700" />
          <div className="h-10 animate-pulse rounded bg-gray-700/70" />
        </div>
      ) : null}
    </Dialog>
  );
}

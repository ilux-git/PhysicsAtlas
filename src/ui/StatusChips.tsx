import type { EquationStatuses } from '../engines/equation.ts';
import { REVIEW_LABELS } from './labels.ts';

export type ChipTone = 'ok' | 'warning' | 'danger' | 'neutral' | 'accent';

export interface ChipItem {
  label: string;
  tone: ChipTone;
  title?: string;
}

export function StatusChips({ chips }: { chips: readonly ChipItem[] }) {
  return (
    <ul className="status-chips" aria-label="Статусы проверки">
      {chips.map((chip) => (
        <li key={`${chip.label}:${chip.tone}`} className={`status-chip tone-${chip.tone}`} title={chip.title}>
          {chip.label}
        </li>
      ))}
    </ul>
  );
}

export function equationStatusChips(statuses: EquationStatuses): ChipItem[] {
  const chips: ChipItem[] = [];
  chips.push({
    label: statuses.structural.status === 'ok' ? 'структура: ок' : 'структура: ошибка',
    tone: statuses.structural.status === 'ok' ? 'ok' : 'danger',
    title:
      statuses.structural.status === 'ok'
        ? 'AST корректно разбирается, все переменные ссылаются на канонические величины.'
        : statuses.structural.messages.join(' '),
  });
  chips.push({
    label:
      statuses.dimensional.status === 'ok'
        ? `размерности: ок${statuses.dimensional.dimension ? ` (${statuses.dimensional.dimension})` : ''}`
        : 'размерности: не совпадают',
    tone: statuses.dimensional.status === 'ok' ? 'ok' : 'danger',
    title:
      statuses.dimensional.status === 'ok'
        ? 'Левая и правая части уравнения имеют одинаковую размерность. Это не доказывает физическую корректность формулы.'
        : statuses.dimensional.messages.join(' '),
  });
  chips.push({
    label: `экспертиза: ${REVIEW_LABELS[statuses.physicalReview]}`,
    tone: statuses.physicalReview === 'standard-form' ? 'accent' : 'warning',
    title:
      'Независимая физическая экспертиза в атласе не проводилась; статус описывает происхождение формулировки, а не её проверку.',
  });
  chips.push({
    label: statuses.conditionsStatus === 'explicit' ? 'условия: указаны' : 'условия: не указаны',
    tone: statuses.conditionsStatus === 'explicit' ? 'ok' : 'warning',
    title: 'Условия применимости должны быть явными; ограничения не скрываются.',
  });
  return chips;
}
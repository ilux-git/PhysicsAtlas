import type { EquationStatuses } from '../engines/equation.ts';
import { EXPERT_LABELS, FORMULATION_LABELS } from './labels.ts';

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
  const formulationTone: Record<EquationStatuses['formulation'], ChipTone> = {
    'standard-school': 'accent',
    definition: 'neutral',
    derived: 'neutral',
    draft: 'warning',
  };
  const expertTone: Record<EquationStatuses['expert'], ChipTone> = {
    none: 'warning',
    requested: 'warning',
    completed: 'ok',
    rejected: 'danger',
  };
  return [
    {
      label: statuses.structural.status === 'ok' ? 'структура: ок' : 'структура: ошибка',
      tone: statuses.structural.status === 'ok' ? 'ok' : 'danger',
      title:
        statuses.structural.status === 'ok'
          ? 'AST корректно разбирается, все переменные ссылаются на канонические величины.'
          : statuses.structural.messages.join(' '),
    },
    {
      label:
        statuses.dimensional.status === 'ok'
          ? `размерности: ок${statuses.dimensional.dimension ? ` (${statuses.dimensional.dimension})` : ''}`
          : 'размерности: не совпадают',
      tone: statuses.dimensional.status === 'ok' ? 'ok' : 'danger',
      title:
        statuses.dimensional.status === 'ok'
          ? 'Левая и правая части уравнения имеют одинаковую размерность. Это не доказывает физическую корректность формулы.'
          : statuses.dimensional.messages.join(' '),
    },
    {
      label: `формулировка: ${FORMULATION_LABELS[statuses.formulation]}`,
      tone: formulationTone[statuses.formulation],
      title: 'Тип и происхождение записи; не является результатом физической экспертизы.',
    },
    {
      label: `экспертиза: ${EXPERT_LABELS[statuses.expert]}`,
      tone: expertTone[statuses.expert],
      title:
        'Независимая физическая экспертиза подтверждается только записью рецензента, даты и источника. Размерностная проверка её не заменяет.',
    },
    {
      label: statuses.conditionsStatus === 'explicit' ? 'условия: указаны' : 'условия: не указаны',
      tone: statuses.conditionsStatus === 'explicit' ? 'ok' : 'warning',
      title: 'Условия применимости должны быть явными; ограничения не скрываются.',
    },
  ];
}
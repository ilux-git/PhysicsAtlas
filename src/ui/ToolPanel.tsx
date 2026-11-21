import type { Tab } from '../app/state.tsx';

const MESSAGES: Record<Exclude<Tab, 'card'>, { title: string; text: string }> = {
  formulas: {
    title: 'Формулы',
    text: 'Инструмент исследования формул: состав уравнения, переменные, связанные законы и допустимые формы.',
  },
  converter: {
    title: 'Конвертер единиц',
    text: 'Перевод поддерживаемых единиц с проверкой размерности и группы величин.',
  },
  derivation: {
    title: 'Вывод формулы',
    text: 'Шаги математических преобразований с ограничениями и предусловиями.',
  },
  path: {
    title: 'Поиск вычислительного пути',
    text: 'Цепочки от известных величин к целевой с проверкой условий применимости.',
  },
};

export function ToolPanel({ tab }: { tab: Exclude<Tab, 'card'> }) {
  const message = MESSAGES[tab];
  return (
    <div className="tool-placeholder">
      <h2>{message.title}</h2>
      <p>{message.text}</p>
      <p className="section-hint">Инструмент подключается на следующем шаге разработки.</p>
    </div>
  );
}
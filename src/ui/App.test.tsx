import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../app/App.tsx';

afterEach(() => {
  window.history.replaceState(null, '', '#');
});

function renderApp() {
  return render(<App />);
}

describe('atlas application', () => {
  it('renders the local map and the inspector for the default focus', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Physics Atlas' })).toBeInTheDocument();
    expect(screen.getByText('Локальная область')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Сила' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Величина: Сила' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Единица: ньютон' })).toBeInTheDocument();
  });

  it('opens an equation card with formula and independent status chips', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Уравнение: Второй закон Ньютона (модули)' }));

    expect(
      screen.getByRole('heading', { level: 2, name: 'Второй закон Ньютона (модули)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/размерности: ок/)).toBeInTheDocument();
    expect(screen.getByText(/экспертиза: стандартная школьная формулировка/)).toBeInTheDocument();
    expect(screen.getByText(/условия: указаны/)).toBeInTheDocument();
    expect(screen.getByText(/Размерностная проверка не заменяет физическую экспертизу/)).toBeInTheDocument();
  });

  it('finds a quantity through search and selects it', async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole('combobox', { name: /Поиск по атласу/ });
    await user.type(search, 'масса');

    const results = screen.getByRole('listbox', { name: 'Результаты поиска' });
    const option = within(results)
      .getAllByRole('option')
      .find((element) => element.textContent?.includes('Масса') && element.textContent.includes('Величина'));
    if (!option) throw new Error('В результатах поиска нет величины «Масса»');
    await user.click(option);

    expect(screen.getByRole('heading', { level: 2, name: 'Масса' })).toBeInTheDocument();
  });

  it('changing the school level changes the explanation', async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole('combobox', { name: /Поиск по атласу/ });
    await user.type(search, 'масса');
    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((element) => element.textContent?.includes('Масса') && element.textContent.includes('Величина'));
    if (!option) throw new Error('В результатах поиска нет величины «Масса»');
    await user.click(option);

    await user.click(screen.getByRole('button', { name: '7–8' }));
    expect(await screen.findByText(/Масса показывает, насколько трудно разогнать тело/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '10–11' }));
    expect(await screen.findByText(/Масса входит во второй закон Ньютона/)).toBeInTheDocument();
  });

  it('filters map nodes by entity kind', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('button', { name: 'Уравнение: Второй закон Ньютона (модули)' })).toBeInTheDocument();
    const filterPanel = screen.getByText('Фильтры').closest('details');
    if (!filterPanel) throw new Error('Нет панели фильтров');
    const checkbox = within(filterPanel).getByRole('checkbox', { name: 'Уравнение' });
    await user.click(checkbox);
    expect(
      screen.queryByRole('button', { name: 'Уравнение: Второй закон Ньютона (модули)' }),
    ).not.toBeInTheDocument();
  });

  it('honours a deep link from the URL hash', () => {
    window.history.replaceState(null, '', '#node=law.newton.second&level=10-11');
    renderApp();
    expect(screen.getByRole('heading', { level: 2, name: 'Второй закон Ньютона' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10–11' })).toHaveAttribute('aria-pressed', 'true');
  });
});
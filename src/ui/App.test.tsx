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
    expect(screen.getAllByText(/формулировка: стандартная школьная запись/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/экспертиза: не проводилась/).length).toBeGreaterThan(0);
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

  it('reacts to an external hash change without a page reload', async () => {
    renderApp();
    window.history.replaceState(null, '', '#node=q.mass&level=7-8&tab=card');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Масса' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7–8' })).toHaveAttribute('aria-pressed', 'true');
  });

it('finds the mechanics chain and marks it conditionally valid', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Поиск пути' }));

    expect(screen.getAllByText(/вычисления: символьная цепочка/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/условия: не подтверждены/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/экспертиза: не проводилась/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: 'Условия применимости' })).toBeInTheDocument();
    expect(document.querySelectorAll('.path-card').length).toBeGreaterThan(0);
    const statuses = screen.getAllByLabelText(/Статус условия/);
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('turns the path valid when every condition is confirmed', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Поиск пути' }));
    const conditionSelects = screen.getAllByLabelText(/Статус условия/);
    for (const select of conditionSelects) {
      await user.selectOptions(select, 'confirmed');
    }
    expect(screen.getAllByText(/условия: подтверждены/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/экспертиза: не проводилась/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/допустимый/)).toHaveLength(0);
  });

  it('computes numeric results for the chain with units', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Поиск пути' }));
    await user.type(screen.getByLabelText('Значение 1'), '2');
    await user.type(screen.getByLabelText('Значение 2'), '3');
    await user.type(screen.getByLabelText('Значение 3'), '4');
    await user.type(screen.getByLabelText('Значение 4'), '2');
    expect(screen.getAllByText(/≈ 12 W/).length).toBeGreaterThan(0);
  });

  it('marks the path invalid when a condition is violated', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Поиск пути' }));
    const inertial = screen.getByLabelText(/Статус условия «Инерциальная система отсчёта»/);
    await user.selectOptions(inertial, 'violated');
    expect(screen.getAllByText(/условия: нарушены/).length).toBeGreaterThan(0);
  });

  it('converts units and rejects incompatible ones', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Конвертер' }));
    expect(screen.getByText(/1\s*000\s*m/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Целевая единица'), 'unit.newton');
    expect(screen.getByText('размерности не совпадают')).toBeInTheDocument();
  });

  it('shows the formula explorer for the selected equation', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#node=eq.newton2.magnitudes');
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Формулы' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Второй закон Ньютона (модули)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Переменные' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Связанные законы' })).toBeInTheDocument();
  });

  it('filters the map by physics domain', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('button', { name: 'Уравнение: Второй закон Ньютона (модули)' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Раздел физики' }), 'domain.electricity');
    expect(
      screen.queryByRole('button', { name: 'Уравнение: Второй закон Ньютона (модули)' }),
    ).not.toBeInTheDocument();

    const search = screen.getByRole('combobox', { name: /Поиск по атласу/ });
    await user.type(search, 'напряжение');
    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((element) => element.textContent?.includes('Напряжение'));
    if (!option) throw new Error('В результатах поиска нет величины «Напряжение»');
    await user.click(option);
    expect(screen.getByRole('button', { name: 'Уравнение: Закон Ома для участка цепи' })).toBeInTheDocument();
  });

it('shows derivation steps and the structural check', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#node=der.newton2.acceleration');
    renderApp();
    await user.click(screen.getByRole('tab', { name: 'Вывод' }));
    expect(screen.getByText(/Разделим обе части уравнения на массу m/)).toBeInTheDocument();
    expect(screen.getByText(/Проверка пройдена/)).toBeInTheDocument();
  });
});
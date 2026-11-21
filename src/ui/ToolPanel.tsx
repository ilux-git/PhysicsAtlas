import type { Tab } from '../app/state.tsx';
import { DerivationView } from './DerivationView.tsx';
import { FindPathPanel } from './FindPathPanel.tsx';
import { FormulaExplorer } from './FormulaExplorer.tsx';
import { UnitConverter } from './UnitConverter.tsx';

export function ToolPanel({ tab }: { tab: Exclude<Tab, 'card'> }) {
  switch (tab) {
    case 'formulas':
      return <FormulaExplorer />;
    case 'converter':
      return <UnitConverter />;
    case 'derivation':
      return <DerivationView />;
    case 'path':
      return <FindPathPanel />;
  }
}
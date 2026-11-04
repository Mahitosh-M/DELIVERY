import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
const save=vi.hoisted(()=>vi.fn(async()=>{}));
vi.mock('../../.release/cisapp/src/services/firestoreService',async()=>{const {DEFAULT_SETTINGS}=await import('../../.release/cisapp/src/utils/settings');return{getAppSettings:async()=>structuredClone(DEFAULT_SETTINGS),updateAppSettings:save,updateAppSettingsToggle:vi.fn()};});
vi.mock('../../.release/cisapp/src/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{role:'Admin',uid:'admin'}})}));
vi.mock('../../.release/cisapp/src/services/migrationService',()=>({getDerivedDataMigrationStatus:async()=>({}),runDerivedDataMigration:vi.fn()}));
vi.mock('../../.release/cisapp/src/components/InvoiceChargeSettings',()=>({default:()=>null}));
import Settings from '../../.release/cisapp/src/pages/Settings';
afterEach(()=>{cleanup();save.mockClear();});
it('Admin saves independent Medical credit, PC, targets and bonuses without editing normal settings',async()=>{
 render(<Settings/>);await screen.findByText('Medical Customer Settings');fireEvent.click(screen.getByText('Medical Customer Settings'));
 fireEvent.change(screen.getByLabelText('Medical Active Partner credit days'),{target:{value:'21'}});fireEvent.change(screen.getByLabelText('Medical Active Partner PC percentage'),{target:{value:'3.5'}});fireEvent.change(screen.getByLabelText('Medical Active Partner monthly order target'),{target:{value:'8'}});fireEvent.change(screen.getByLabelText('Medical new customer bonus PC'),{target:{value:'35'}});
 fireEvent.submit(screen.getByLabelText('Medical Active Partner credit days').closest('form')!);
 await waitFor(()=>expect(save).toHaveBeenCalled());const settings=save.mock.calls[0][0] as any;expect(settings.medicalSettings.creditDays['Tier 4']).toBe(21);expect(settings.medicalSettings.giftPercentages['Tier 4']).toBe(3.5);expect(settings.medicalSettings.targetSettings.tier4.monthlyOrderTarget).toBe(8);expect(settings.medicalSettings.loyaltySettings.newCustomerBonus).toBe(35);expect(settings.creditDays['Tier 4']).toBe(0);expect(settings.giftPercentages['Tier 4']).toBe(1);expect(settings.targetSettings.tier4.monthlyOrderTarget).toBe(1);expect(settings.loyaltySettings.newCustomerBonus).toBe(20);
});

vi.mock('../../.release/cisapp/src/components/RouteMap',()=>({RouteMap:()=>null}));
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const profile=vi.hoisted(()=>({role:'Staff'}));
vi.mock('../../.release/cisapp/src/contexts/AuthContext',()=>({useAuth:()=>({canDeleteRecords:false,userProfile:{uid:'test-staff',role:profile.role,shopId:'SHOP_A'}})}));
vi.mock('../../.release/cisapp/src/hooks/useIsMobile',()=>({useIsMobile:()=>true}));
vi.mock('../../.release/cisapp/src/services/firestoreService',async()=>{const {calculateDynamicDueDate,DEFAULT_SETTINGS}=await import('../../.release/cisapp/src/utils/settings');return ({
 calculateDueDate:calculateDynamicDueDate,createPayment:vi.fn(),createInvoice:vi.fn(),deleteInvoiceRecord:vi.fn(),updateInvoiceRecord:vi.fn(),updatePaymentRecord:vi.fn(),
 getCustomers:async()=>['medical','customer'].map(type=>({id:type,name:type+' test',customerType:type,tier:'Tier 4',mobile:'0000000000',area:'Test',branchId:'MASKI',previousOutstandingAmount:0,status:'Active'})),getInvoices:async()=>[{id:'i1',invoiceNumber:'A-1',customerId:'c1',customerName:'Test customer',shopId:'SHOP_A',date:'2026-10-25',dueDate:'2026-10-25',totalSales:2000,totalProfit:0,costAmount:2000,transportAmount:0,totalCost:2000,salesAmount:2000,createdAt:'2026-10-25'}],getInvoicesByCustomerId:async()=>[],getNextInvoiceNumber:async()=>'A-2',getAppSettings:async()=>DEFAULT_SETTINGS,getPaymentsByInvoiceId:async()=>[],getPaymentsByCustomerId:async()=>[],getPaymentsByInvoiceIds:async()=>[]
});});
vi.mock('../../.release/cisapp/src/services/salesappDirectory',()=>({getSalesappBranchStaff:async()=>[]}));
vi.mock('../../.release/cisapp/src/services/creditService',()=>({getCustomerCreditSummary:vi.fn()}));
vi.mock('../../.release/cisapp/src/services/derivedDataService',()=>({recalculateCustomerDerivedData:vi.fn()}));
vi.mock('../../.release/cisapp/src/services/dispatchService',()=>({dispatchRequest:async()=>({routes:[]})}));
import Invoices from '../../.release/cisapp/src/pages/Invoices';
afterEach(cleanup);

it('Medical selection and date changes prefill 15 days while normal Tier 4 stays same-day',async()=>{
 render(<MemoryRouter><Invoices/></MemoryRouter>);await within(screen.getByLabelText('Customer',{exact:true})).findByRole('option',{name:/medical test/});fireEvent.change(screen.getByLabelText('Invoice Date'),{target:{value:'2026-11-01'}});fireEvent.change(screen.getByLabelText('Customer',{exact:true}),{target:{value:'medical'}});expect(screen.getByLabelText('Due Date')).toHaveValue('2026-11-16');fireEvent.change(screen.getByLabelText('Invoice Date'),{target:{value:'2026-11-03'}});expect(screen.getByLabelText('Due Date')).toHaveValue('2026-11-18');fireEvent.change(screen.getByLabelText('Customer',{exact:true}),{target:{value:'customer'}});expect(screen.getByLabelText('Due Date')).toHaveValue('2026-11-03');
});

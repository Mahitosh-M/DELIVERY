import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const profile=vi.hoisted(()=>({role:'Staff'}));
vi.mock('../../../CISapp/src/contexts/AuthContext',()=>({useAuth:()=>({canDeleteRecords:false,userProfile:{uid:'test-staff',role:profile.role,shopId:'SHOP_A'}})}));
vi.mock('../../../CISapp/src/hooks/useIsMobile',()=>({useIsMobile:()=>true}));
vi.mock('../../../CISapp/src/services/firestoreService',()=>({
 calculateDueDate:vi.fn(),createPayment:vi.fn(),createInvoice:vi.fn(),deleteInvoiceRecord:vi.fn(),updateInvoiceRecord:vi.fn(),updatePaymentRecord:vi.fn(),
 getCustomers:async()=>[],getInvoices:async()=>[{id:'i1',invoiceNumber:'A-1',customerId:'c1',customerName:'Test customer',shopId:'SHOP_A',date:'2026-10-25',dueDate:'2026-10-25',totalSales:2000,totalProfit:0,costAmount:2000,transportAmount:0,totalCost:2000,salesAmount:2000,createdAt:'2026-10-25'}],getInvoicesByCustomerId:async()=>[],getNextInvoiceNumber:async()=>'A-2',getAppSettings:async()=>undefined,getPaymentsByInvoiceId:async()=>[],getPaymentsByCustomerId:async()=>[],getPaymentsByInvoiceIds:async()=>[]
}));
vi.mock('../../../CISapp/src/services/salesappDirectory',()=>({getSalesappBranchStaff:async()=>[]}));
vi.mock('../../../CISapp/src/services/creditService',()=>({getCustomerCreditSummary:vi.fn()}));
vi.mock('../../../CISapp/src/services/derivedDataService',()=>({recalculateCustomerDerivedData:vi.fn()}));
vi.mock('../../../CISapp/src/services/dispatchService',()=>({dispatchRequest:async()=>({routes:[]})}));
import Invoices from '../../../CISapp/src/pages/Invoices';
afterEach(cleanup);
it.each(['Staff','Admin'])('%s sees the mobile delivery toggle, delivery requests and saved-invoice action',async(role)=>{
 profile.role=role;render(<MemoryRouter><Invoices/></MemoryRouter>);
 const toggle=screen.getByRole('checkbox',{name:'Delivery required',exact:true});expect(toggle).toBeVisible();fireEvent.click(toggle);expect(toggle).toBeChecked();
 expect(screen.getByRole('link',{name:'Delivery requests'})).toHaveAttribute('href','/dispatch');
 fireEvent.click(await screen.findByRole('button',{name:'Mark for delivery'}));
 expect(await screen.findByRole('dialog')).toBeVisible();expect(screen.getByLabelText('Delivery route')).toBeVisible();
});

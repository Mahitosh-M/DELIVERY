import {afterEach,it,expect} from 'vitest';
import {useState} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {NumberInput} from '../src/components/ui/number-input';
import {paise} from '../src/domain';
afterEach(cleanup);
function NumericModel(){const [value,setValue]=useState(0);return <><NumberInput aria-label="Reading" required value={value} onChange={e=>setValue(Number(e.target.value))}/><output>{value}</output><button onClick={()=>setValue(350)}>Load reading</button><button onClick={()=>setValue(0)}>Reset reading</button></>;}
it('allows deleting a model-backed zero and typing a whole number without restoring the zero',()=>{render(<NumericModel/>);const input=screen.getByLabelText('Reading');fireEvent.change(input,{target:{value:''}});expect(input).toHaveValue(null);expect((input as HTMLInputElement).checkValidity()).toBe(false);fireEvent.change(input,{target:{value:'100'}});expect(input).toHaveValue(100);expect(screen.getByRole('status')).toHaveTextContent('100');});
it('accepts an explicitly entered zero and refreshes externally changed readings',()=>{render(<NumericModel/>);const input=screen.getByLabelText('Reading');fireEvent.change(input,{target:{value:''}});fireEvent.change(input,{target:{value:'0'}});expect(input).toHaveValue(0);fireEvent.click(screen.getByRole('button',{name:'Load reading'}));expect(input).toHaveValue(350);fireEvent.click(screen.getByRole('button',{name:'Reset reading'}));expect(input).toHaveValue(0);});
it('removes numeric focus before wheel stepping can change a money value',()=>{render(<NumberInput aria-label="Amount" value="100" step="0.01"/>);const input=screen.getByLabelText('Amount');input.focus();fireEvent.wheel(input,{deltaY:100});expect(input).not.toHaveFocus();expect(input).toHaveValue(100);});
it('keeps exact integer paise for whole and decimal amounts',()=>{expect(paise('100')).toBe(10000);expect(paise('100.00')).toBe(10000);expect(paise('99.98')).toBe(9998);expect(paise('0.01')).toBe(1);});

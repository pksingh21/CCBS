import React from 'react';
import { Formik } from 'formik';
import DatePicker from '@mui/lab/DatePicker';
import './Form.scss';
import TextField from '@mui/material/TextField';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
const initialValues = {
    email: new Date(),
    password: ''
};

const validate = (values) => {
    let errors = {};

    return errors;
};

const submitForm = (values) => {
    console.log(values);
};
const Form = () => {
    return (
        <Formik initialValues={initialValues} validate={validate} onSubmit={submitForm}>
            {(formik) => {
                const { values, handleChange, handleSubmit, errors, touched, handleBlur, isValid, dirty } = formik;
                return (
                    <div className="container">
                        <form onSubmit={handleSubmit}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Date Checker"
                                    inputFormat="dd/MM/yyyy"
                                    value={values.email}
                                    onChange={handleChange}
                                    variant="outlined"
                                    renderInput={(params) => <TextField {...params} />}
                                />
                                {errors.email && touched.email && <span className="error">{errors.email}</span>}
                            </LocalizationProvider>

                            <div className="form-row">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    id="password"
                                    value={values.password}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={errors.password && touched.password ? 'input-error' : null}
                                />
                                {errors.password && touched.password && <span className="error">{errors.password}</span>}
                            </div>

                            <button type="submit" className={!(dirty && isValid) ? 'disabled-btn' : ''} disabled={!(dirty && isValid)}>
                                Sign In
                            </button>
                        </form>
                    </div>
                );
            }}
        </Formik>
    );
};

export default Form;


using System;
using System.Collections.Generic;
using System.Text;
using H3;

public class {SchemaCode}_ListViewController : H3.SmartForm.ListViewController
{
    public {SchemaCode}_ListViewController(H3.SmartForm.ListViewRequest request) : base(request)
    {
    }

    protected override void OnLoad(H3.SmartForm.LoadListViewResponse response)
    {
        base.OnLoad(response);
    }

    protected override void OnSubmit(string actionName, H3.SmartForm.ListViewPostValue postValue, H3.SmartForm.SubmitListViewResponse response)
    {
        base.OnSubmit(actionName, postValue, response);
    }
}
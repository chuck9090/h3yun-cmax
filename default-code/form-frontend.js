/* 控件接口说明：
 * 1. 读取控件: this.***,*号输入控件编码;
 * 2. 读取控件的值： this.***.GetValue();
 * 3. 设置控件的值： this.***.SetValue(???);
 * 4. 绑定控件值变化事件： this.***.BindChange(key,function(){})，key是定义唯一的方法名;
 * 5. 解除控件值变化事件： this.***.UnbindChange(key);
 * 6. CheckboxList、DropDownList、RadioButtonList: $.***.AddItem(value,text),$.***.ClearItems();
 */
/* 公共接口：
 * 1. ajax：$.SmartForm.PostForm(actionName,data,callBack,errorBack,async),
 *          actionName:提交的ActionName;data:提交后台的数据;callback:回调函数;errorBack:错误回调函数;async:是否异步;
 * 2. 打开表单：$.IShowForm(schemaCode, objectId, checkIsChange)，
 *          schemaCode:表单编码;objectId;表单数据Id;checkIsChange:关闭时，是否感知变化;
 * 3. 定位接口：$.ILocation();
 */

// 表单插件代码
$.extend($.JForm,{
    // 加载事件
    OnLoad:function(){
    },

    // 按钮事件
    OnLoadActions:function(actions){
    },

    // 提交校验
    OnValidate:function(actionControl){
        return true;
    },

    // 提交前事件
    BeforeSubmit:function(action, postValue){
    },

    // 提交后事件
    AfterSubmit:function(action, responseValue){
    }
});
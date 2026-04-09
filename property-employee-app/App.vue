<script>
export default {
  onLaunch: function () {
    console.log('App Launch')
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style lang="scss">
/* 注意要写在第一行，同时给style标签加入lang="scss"属性 */
@import 'uview-plus/index.scss';

/* 全局基础样式（property-employee-app 原版浅色） */
page {
  background-color: #f5f6f7;
  font-size: 28rpx;
  color: #333;
}

button::after {
  border: none;
}

/* 强制覆盖uview-plus复选框/单选框选中时的实心背景，改为透明背景+主题色打勾 */
.u-checkbox-group .u-checkbox__icon-wrap--checked,
.u-radio-group .u-radio__icon-wrap--checked {
  background-color: transparent !important;
  border-color: #2979ff !important;
}

.u-checkbox-group .u-checkbox__icon-wrap--checked .u-icon__icon,
.u-radio-group .u-radio__icon-wrap--checked .u-icon__icon {
  color: #2979ff !important;
}

/* 异常单选框选中时变红 */
.u-radio-group .u-radio__icon-wrap--checked[style*='border-color: rgb(228, 61, 51)'],
.u-radio-group .u-radio__icon-wrap--checked[style*='border-color: #e43d33'] {
  border-color: #e43d33 !important;
}
.u-radio-group .u-radio__icon-wrap--checked[style*='border-color: rgb(228, 61, 51)'] .u-icon__icon,
.u-radio-group .u-radio__icon-wrap--checked[style*='border-color: #e43d33'] .u-icon__icon {
  color: #e43d33 !important;
}
</style>
